import os
import ssl
import httpx
import chromadb
from chromadb.config import Settings
from typing import List, Dict, Any, Tuple, Optional
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from pypdf import PdfReader

from .models import College, Cutoff, AcademicYear, Branch

# Bypass SSL verification for corporate/proxy networks
def _make_gemini_client(api_key: str):
    """Creates a Gemini client with SSL verification disabled for corporate proxy environments."""
    try:
        custom_client = httpx.Client(verify=False)
        return genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(httpx_client=custom_client)
        )
    except Exception:
        # Fallback: standard client
        return genai.Client(api_key=api_key)

class RAGService:
    def __init__(self, db: Session, gemini_api_key: Optional[str] = None):
        self.db = db
        self.api_key = gemini_api_key
        
        # Initialize Gemini Client if key exists
        self.client = None
        if self.api_key:
            self.client = _make_gemini_client(self.api_key)
            
        # Initialize ChromaDB client (local persistent storage)
        persist_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "chroma_db")
        
        # Fallback to /tmp if running on Vercel (read-only filesystem)
        if os.getenv("VERCEL") or not os.access(os.path.dirname(persist_dir) or ".", os.W_OK):
            import shutil
            tmp_dir = "/tmp/chroma_db"
            if not os.path.exists(tmp_dir):
                if os.path.exists(persist_dir):
                    shutil.copytree(persist_dir, tmp_dir, dirs_exist_ok=True)
                else:
                    os.makedirs(tmp_dir, exist_ok=True)
            persist_dir = tmp_dir
        else:
            os.makedirs(persist_dir, exist_ok=True)
            
        self.chroma_client = chromadb.PersistentClient(path=persist_dir)
        # Create or get collection
        self.collection = self.chroma_client.get_or_create_collection(
            name="mht_cet_documents",
            metadata={"hnsw:space": "cosine"}
        )

    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generates embeddings using Gemini API in batches of 100 (or falls back to mock embeddings)."""
        if self.client and self.api_key:
            try:
                embeddings = []
                batch_size = 100
                for i in range(0, len(texts), batch_size):
                    batch = texts[i:i + batch_size]
                    response = self.client.models.embed_content(
                        model="text-embedding-004",
                        contents=batch
                    )
                    # Parse embeddings response
                    embeddings.extend([embedding.values for embedding in response.embeddings])
                return embeddings
            except Exception as e:
                print(f"Error calling Gemini Embedding API: {e}")
                
        # Simple local fallback/mock embeddings for development/testing if API key not set
        # Return a list of pseudo-random floats of length 768
        import random
        random.seed(42)
        return [[random.uniform(-1, 1) for _ in range(768)] for _ in texts]

    def add_pdf_to_vector_db(self, file_path: str, document_id: int, filename: str) -> int:
        """Chunks PDF text and indexes it in ChromaDB."""
        reader = PdfReader(file_path)
        chunks = []
        metadatas = []
        ids = []
        
        chunk_size = 1000
        overlap = 200
        
        chunk_idx = 0
        for page_num in range(len(reader.pages)):
            page_text = reader.pages[page_num].extract_text()
            if not page_text or not page_text.strip():
                continue
                
            # Perform simple overlapping chunking
            start = 0
            while start < len(page_text):
                end = start + chunk_size
                chunk = page_text[start:end]
                
                chunks.append(chunk)
                metadatas.append({
                    "document_id": document_id,
                    "filename": filename,
                    "page": page_num + 1
                })
                ids.append(f"doc_{document_id}_chunk_{chunk_idx}")
                
                start += chunk_size - overlap
                chunk_idx += 1
                
        if not chunks:
            return 0
            
        # Generate embeddings and add to collection
        embeddings = self.generate_embeddings(chunks)
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas
        )
        return len(chunks)

    def delete_document_chunks(self, document_id: int):
        """Deletes all vector chunks associated with a document ID."""
        # Query items first
        try:
            self.collection.delete(
                where={"document_id": document_id}
            )
        except Exception as e:
            print(f"Error deleting chunks from ChromaDB: {e}")

    def query_documents(self, query_text: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Queries ChromaDB using cosine similarity."""
        query_embeddings = self.generate_embeddings([query_text])
        results = self.collection.query(
            query_embeddings=query_embeddings,
            n_results=limit
        )
        
        formatted_results = []
        if results and results["documents"]:
            for i in range(len(results["documents"][0])):
                formatted_results.append({
                    "content": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "distance": results["distances"][0][i] if "distances" in results and results["distances"] else 0.0
                })
        return formatted_results

    def get_related_sql_data(self, query: str) -> str:
        """
        Scans query for college names or codes to fetch exact statistics 
        from PostgreSQL (such as cutoffs, placement packages, fees).
        Returns a context string of structured records.
        """
        # Fetch all colleges to check name match
        colleges = self.db.query(College).all()
        matched_colleges = []
        
        query_lower = query.lower()
        for col in colleges:
            # Match by code or name
            if str(col.code) in query or col.name.lower() in query_lower:
                matched_colleges.append(col)
                
        if not matched_colleges:
            return ""
            
        context_lines = ["\n[Structured SQL Data from Database]:"]
        for col in matched_colleges:
            # Fetch latest cutoffs (average of latest cap round cutoffs for OPEN/OBC)
            latest_cutoffs = self.db.query(Cutoff).filter(
                Cutoff.college_code == col.code
            ).order_by(Cutoff.cap_round.desc()).limit(10).all()
            
            cutoff_lines = []
            for cut in latest_cutoffs:
                cutoff_lines.append(f"Branch: {cut.branch_code}, Round: {cut.cap_round}, Category: {cut.category}, Seat: {cut.seat_type}, Cutoff Rank: {cut.rank}, Percentile: {cut.percentile}")
            
            cutoff_summary = "; ".join(cutoff_lines) if cutoff_lines else "No cutoff data recorded"
            
            context_lines.append(
                f"- Institute: {col.name} (Code: {col.code})\n"
                f"  Status: {col.status}, Autonomous: {col.autonomous}, Minority: {col.minority_status}\n"
                f"  Tuition Fees (OPEN): {col.fees} INR, Hostel Availability: {col.hostel_availability}\n"
                f"  Average Package: {col.average_package} LPA, Highest Package: {col.highest_package} LPA\n"
                f"  Official Website: {col.official_website}\n"
                f"  Recent Cutoffs: {cutoff_summary}"
            )
            
        return "\n".join(context_lines)

    def answer_admission_query(self, query_text: str, chat_history: List[Dict[str, str]] = None) -> Tuple[str, List[str]]:
        """
        Retrieves relevant vector database chunks and database records, 
        and instructs Gemini to formulate an exact answer citing sources.
        """
        if not self.client:
            return ("AI Chat is in offline mode (GEMINI_API_KEY is not set). "
                    "Please configure it to get AI-powered responses.", [])
                    
        # 1. Fetch from Vector DB
        chunks = self.query_documents(query_text, limit=4)
        vector_context = "\n".join([
            f"[Source Document: {c['metadata']['filename']}, Page {c['metadata']['page']}]:\n{c['content']}"
            for c in chunks
        ])
        
        # 2. Fetch from SQL DB (hybrid matching)
        sql_context = self.get_related_sql_data(query_text)
        
        # 3. Compile context
        full_context = f"{vector_context}\n{sql_context}"
        
        # 4. Formulate prompt
        system_instruction = """
        You are an AI Admission Counsellor for MHT CET CAP admissions and engineering careers.
        Your goal is to answer the student's query as accurately and helpfully as possible.
        
        RULES:
        1. For questions related to MHT CET cutoffs, seat matrices, fees, and specific college details, prioritize using the provided context (Source Documents and SQL Data). If the context has the data, cite your sources (e.g. (Filename, Page number) or (Official Database)).
        2. For general questions (about engineering branches, career options, study tips, or general conversation) that are NOT in the provided context, use your general knowledge to provide a helpful, supportive, and informative response. Do NOT refuse to answer general queries.
        3. Maintain a warm, encouraging, and professional tone. Format responses nicely using markdown bullet points.
        """
        
        # Format history
        formatted_history = []
        if chat_history:
            for message in chat_history:
                formatted_history.append(f"{message['role'].capitalize()}: {message['content']}")
        history_str = "\n".join(formatted_history)
        
        prompt = f"""
        {history_str}
        
        Context:
        {full_context}
        
        Student Query: {query_text}
        
        Response:
        """
        
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.2
                )
            )
            
            # Extract sources
            sources = []
            for c in chunks:
                src = f"{c['metadata']['filename']} (Page {c['metadata']['page']})"
                if src not in sources:
                    sources.append(src)
            if sql_context:
                sources.append("Official Database Records")
                
            return response.text, sources
            
        except Exception as e:
            return f"Error executing AI RAG Chat: {str(e)}", []
