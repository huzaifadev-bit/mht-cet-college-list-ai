import io
from typing import List, Dict, Any
from openpyxl import Workbook
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    """Canvas class to generate 'Page X of Y' page numbers dynamically."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#718096"))
        
        # Header (Only on page 2 and later)
        if self._pageNumber > 1:
            self.drawString(54, 750, "MHT CET AI College Predictor - Preference List")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)
            
        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 40, page_text)
        self.drawString(54, 40, "Confidential - AI-Generated Admission Guidance Report")
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(54, 52, 558, 52)
        
        self.restoreState()


class DocumentGenerator:
    @staticmethod
    def generate_preference_pdf(
        student_info: Dict[str, Any],
        preference_items: List[Dict[str, Any]]
    ) -> io.BytesIO:
        """
        Generates a premium, highly formatted PDF report of the student's CAP Preference List
        using ReportLab. Includes a summary sheet and a table of ordered choices.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=54,
            leftMargin=54,
            topMargin=54,
            bottomMargin=60
        )
        
        styles = getSampleStyleSheet()
        
        # Custom styles for premium aesthetics
        title_style = ParagraphStyle(
            'CoverTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=24,
            leading=28,
            textColor=colors.HexColor("#1A365D"),
            spaceAfter=10
        )
        
        subtitle_style = ParagraphStyle(
            'CoverSubtitle',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=12,
            leading=16,
            textColor=colors.HexColor("#4A5568"),
            spaceAfter=30
        )
        
        section_heading = ParagraphStyle(
            'SectionHeading',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#2B6CB0"),
            spaceBefore=15,
            spaceAfter=10
        )
        
        body_style = ParagraphStyle(
            'BodyTextCustom',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#2D3748")
        )
        
        cell_style = ParagraphStyle(
            'TableCellCustom',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#2D3748")
        )
        
        cell_bold_style = ParagraphStyle(
            'TableCellBoldCustom',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#1A365D")
        )

        story = []
        
        # --- TITLE SECTION ---
        story.append(Paragraph("MHT CET CAP Preference List", title_style))
        story.append(Paragraph("AI-Optimized Admission Option Form Preference Sheet", subtitle_style))
        story.append(Spacer(1, 10))
        
        # --- STUDENT CARD (Table format) ---
        student_data = [
            [
                Paragraph("<b>Student Name:</b>", body_style), Paragraph(str(student_info.get("name", "N/A")), body_style),
                Paragraph("<b>MHT CET Percentile:</b>", body_style), Paragraph(f"{student_info.get('percentile', 0.0):.4f}%", body_style)
            ],
            [
                Paragraph("<b>State Merit Rank:</b>", body_style), Paragraph(str(student_info.get("rank", "N/A")), body_style),
                Paragraph("<b>Category:</b>", body_style), Paragraph(str(student_info.get("category", "OPEN")), body_style)
            ],
            [
                Paragraph("<b>Home University:</b>", body_style), Paragraph(str(student_info.get("home_university", "N/A")), body_style),
                Paragraph("<b>Gender:</b>", body_style), Paragraph("Female" if student_info.get("gender") == "F" else "Male", body_style)
            ]
        ]
        
        student_table = Table(student_data, colWidths=[120, 130, 120, 130])
        student_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#EDF2F7")),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ]))
        story.append(student_table)
        story.append(Spacer(1, 20))
        
        # --- STRATEGY OVERVIEW ---
        story.append(Paragraph("Strategic AI Recommendation Summary", section_heading))
        
        # Count classifications
        safe_c = sum(1 for item in preference_items if item.get("status") == "Safe")
        high_c = sum(1 for item in preference_items if item.get("status") == "High Chance")
        mod_c = sum(1 for item in preference_items if item.get("status") == "Moderate Chance")
        dream_c = sum(1 for item in preference_items if item.get("status") == "Dream")
        
        summary_text = (
            f"This preference list contains <b>{len(preference_items)}</b> total colleges. "
            f"The distribution is strategically calculated to maximize your admission chances: "
            f"<b>{dream_c}</b> Dream choices (high reach), <b>{high_c + mod_c}</b> Moderate/High choices (target range), "
            f"and <b>{safe_c}</b> Safe choices (secure backup options). "
            f"Always fill your highest-interest colleges first, regardless of cutoff, and end with safe backups."
        )
        story.append(Paragraph(summary_text, body_style))
        story.append(Spacer(1, 20))
        
        # --- PREFERENCE TABLE ---
        story.append(Paragraph("Ordered Options & Choice Codes", section_heading))
        
        # Table columns: Order, Choice Code, College & Branch details, Probability, Fees
        table_headers = [
            Paragraph("<b>Pref</b>", cell_bold_style),
            Paragraph("<b>Choice Code</b>", cell_bold_style),
            Paragraph("<b>College Name & Branch</b>", cell_bold_style),
            Paragraph("<b>Fees</b>", cell_bold_style),
            Paragraph("<b>AI Prob.</b>", cell_bold_style)
        ]
        
        table_rows = [table_headers]
        
        for item in preference_items:
            pref_num = str(item.get("preference_order", ""))
            
            # Choice code is combination: college_code + branch_code (usually 9 digits)
            choice_code = f"{item['college_code']}{item['branch_code']}"
            
            col_br_details = (
                f"<b>{item.get('college_name', 'N/A')}</b><br/>"
                f"<font color='#718096'>{item.get('branch_name', 'N/A')}</font>"
            )
            
            fees_val = item.get("fees")
            fees_str = f"Rs. {fees_val:,}" if fees_val else "N/A"
            
            prob = item.get("probability", 0.0)
            status = item.get("status", "Dream")
            
            # Label color based on status
            color_hex = "#38A169" # green for safe
            if status == "High Chance":
                color_hex = "#3182CE" # blue
            elif status == "Moderate Chance":
                color_hex = "#D69E2E" # amber
            elif status == "Dream":
                color_hex = "#E53E3E" # red
                
            prob_str = f"<b>{prob}%</b><br/><font color='{color_hex}'>{status}</font>"
            
            row = [
                Paragraph(pref_num, cell_style),
                Paragraph(choice_code, cell_style),
                Paragraph(col_br_details, cell_style),
                Paragraph(fees_str, cell_style),
                Paragraph(prob_str, cell_style)
            ]
            table_rows.append(row)
            
        # Column widths: Pref (40), Choice Code (70), Details (280), Fees (60), Prob (54)
        pref_table = Table(table_rows, colWidths=[35, 75, 275, 65, 54])
        pref_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#E2E8F0")),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('BOTTOMPADDING', (0,0), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,-1), 8),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#F7FAFC")]),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#CBD5E0")),
            ('LINEBELOW', (0,0), (-1,0), 1.5, colors.HexColor("#A0AEC0")),
        ]))
        
        story.append(pref_table)
        
        # Build Document
        doc.build(story, canvasmaker=NumberedCanvas)
        buffer.seek(0)
        return buffer

    @staticmethod
    def generate_preference_excel(
        student_info: Dict[str, Any],
        preference_items: List[Dict[str, Any]]
    ) -> io.BytesIO:
        """
        Generates a clean Excel spreadsheet (.xlsx) containing the student's
        ordered preferences, college codes, branch details, packages, and fees.
        """
        wb = Workbook()
        ws = wb.active
        ws.title = "CAP Preferences"
        
        # Write headers
        headers = [
            "Preference Order", 
            "Institute Code", 
            "Branch Code", 
            "Choice Code", 
            "College Name", 
            "Branch Name", 
            "Annual Fees (INR)", 
            "Autonomous", 
            "Average Package (LPA)", 
            "Highest Package (LPA)", 
            "AI Admission Probability (%)", 
            "Probability Status"
        ]
        ws.append(headers)
        
        # Write rows
        for item in preference_items:
            choice_code = f"{item['college_code']}{item['branch_code']}"
            ws.append([
                item.get("preference_order"),
                item.get("college_code"),
                item.get("branch_code"),
                choice_code,
                item.get("college_name"),
                item.get("branch_name"),
                item.get("fees"),
                "Yes" if item.get("autonomous") else "No",
                item.get("average_package"),
                item.get("highest_package"),
                item.get("probability"),
                item.get("status")
            ])
            
        # Style columns: auto-fit width
        for col in ws.columns:
            max_len = 0
            for cell in col:
                val_str = str(cell.value or '')
                if len(val_str) > max_len:
                    max_len = len(val_str)
            col_letter = col[0].column_letter
            ws.column_dimensions[col_letter].width = max(max_len + 3, 10)
            
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output
