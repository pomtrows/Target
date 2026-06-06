import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

function parseHexColor(colorStr) {
  if (!colorStr) return null;
  colorStr = colorStr.trim().toLowerCase();
  
  // Match hex format (e.g., #ffffff, #fff)
  if (colorStr.startsWith('#')) {
    const hex = colorStr.substring(1);
    if (hex.length === 3) {
      return hex.split('').map(x => x + x).join('');
    }
    return hex;
  }
  
  // Match rgb(r, g, b) or rgba(r, g, b, a) format
  if (colorStr.startsWith('rgb')) {
    const matches = colorStr.match(/\d+/g);
    if (matches && matches.length >= 3) {
      const r = parseInt(matches[0]).toString(16).padStart(2, '0');
      const g = parseInt(matches[1]).toString(16).padStart(2, '0');
      const b = parseInt(matches[2]).toString(16).padStart(2, '0');
      return `${r}${g}${b}`;
    }
  }
  
  // Basic colors fallback
  const basicColors = {
    black: '000000',
    white: 'ffffff',
    red: 'ff0000',
    green: '00ff00',
    blue: '0000ff',
    yellow: 'ffff00',
    cyan: '00ffff',
    magenta: 'ff00ff',
    gray: '808080'
  };
  
  return basicColors[colorStr] || null;
}

/**
 * Parses rich text editor HTML content and returns an array of docx Paragraph objects.
 * Supports recursive block parsing to handle arbitrarily nested tags (e.g. lists inside divs).
 * @param {string} htmlContent - Raw HTML from note editor
 * @returns {Paragraph[]}
 */
export function parseHTMLToDocxParagraphs(htmlContent) {
  if (!htmlContent) return [];
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const body = doc.body;
  const paragraphs = [];

  const blockTags = ['H1', 'H2', 'H3', 'P', 'DIV', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'HR', 'TABLE', 'PRE'];
  
  function isBlockElement(node) {
    if (!node || node.nodeType !== 1) return false;
    return blockTags.includes(node.tagName.toUpperCase());
  }

  /**
   * Recursively walks inline elements and returns TextRun objects.
   */
  function parseInline(element, parentFormat = {}) {
    let runs = [];
    
    function walk(node, currentFormat) {
      if (node.nodeType === 3) { // TEXT_NODE
        const text = node.textContent;
        if (text) {
          runs.push(new TextRun({
            text: text,
            bold: currentFormat.bold || undefined,
            italics: currentFormat.italics || undefined,
            underline: currentFormat.underline ? {} : undefined,
            strike: currentFormat.strike || undefined,
            font: currentFormat.code ? "Courier New" : "Calibri",
            color: currentFormat.color || (currentFormat.code ? "06B6D4" : (currentFormat.link ? "06B6D4" : undefined)),
            shading: currentFormat.code ? { fill: "F1F5F9" } : undefined,
            size: currentFormat.size || 22, // 11pt
          }));
        }
      } else if (node.nodeType === 1) { // ELEMENT_NODE
        const tag = node.tagName.toUpperCase();
        
        if (tag === 'BR') {
          runs.push(new TextRun({
            text: "",
            break: 1
          }));
          return;
        }

        // Avoid double-processing if block tags are nested inside inline contexts
        if (isBlockElement(node)) {
          for (const child of node.childNodes) {
            walk(child, currentFormat);
          }
          return;
        }

        const format = { ...currentFormat };
        if (tag === 'B' || tag === 'STRONG') format.bold = true;
        if (tag === 'I' || tag === 'EM') format.italics = true;
        if (tag === 'U') format.underline = true;
        if (tag === 'STRIKE' || tag === 'DEL' || tag === 'S') format.strike = true;
        if (tag === 'CODE') format.code = true;
        if (tag === 'A') format.link = true;
        
        // Extract inline color if present
        let inlineColor = null;
        if (node.style && node.style.color) {
          inlineColor = parseHexColor(node.style.color);
        } else if (tag === 'FONT' && node.hasAttribute('color')) {
          inlineColor = parseHexColor(node.getAttribute('color'));
        }
        if (inlineColor) {
          format.color = inlineColor;
        }
        
        for (const child of node.childNodes) {
          walk(child, format);
        }
      }
    }
    
    for (const child of element.childNodes) {
      walk(child, parentFormat);
    }
    
    return runs;
  }

  // Accumulator for inline nodes at the current block level
  let accumulatedInlineRuns = [];
  const flushAccumulated = () => {
    if (accumulatedInlineRuns.length > 0) {
      paragraphs.push(new Paragraph({
        children: accumulatedInlineRuns,
        spacing: { after: 120 },
      }));
      accumulatedInlineRuns = [];
    }
  };

  /**
   * Recursively processes nodes, identifying structural blocks vs. inline runs.
   */
  function processNode(node) {
    if (node.nodeType === 3) { // TEXT_NODE
      const text = node.textContent;
      if (text && text.trim()) {
        accumulatedInlineRuns.push(new TextRun({
          text: text,
          font: "Calibri",
          size: 22,
        }));
      }
      return;
    }

    if (node.nodeType !== 1) return; // Skip comments/metadata

    const tag = node.tagName.toUpperCase();
    const isStarred = node.getAttribute?.('data-star') === 'true';

    // If it's a known inline element, collect its text runs
    const inlineTags = ['SPAN', 'B', 'STRONG', 'I', 'EM', 'U', 'STRIKE', 'DEL', 'S', 'CODE', 'A', 'BR', 'FONT'];
    if (inlineTags.includes(tag)) {
      const runs = parseInline(node);
      accumulatedInlineRuns.push(...runs);
      return;
    }

    // Block element encountered: flush any accumulated inline runs
    flushAccumulated();

    // Check if it's a container element containing other block elements
    if (tag === 'DIV' || tag === 'P') {
      const hasBlockChildren = Array.from(node.childNodes).some(child => {
        return child.nodeType === 1 && isBlockElement(child);
      });

      if (hasBlockChildren) {
        for (const child of node.childNodes) {
          processNode(child);
        }
        flushAccumulated();
      } else {
        const runs = parseInline(node);
        if (isStarred) runs.unshift(new TextRun({ text: "⭐ " }));
        paragraphs.push(new Paragraph({
          children: runs,
          spacing: { after: 120 },
        }));
      }
      return;
    }

    // Structural elements
    if (tag === 'H1') {
      const runs = parseInline(node, { bold: true, size: 40 });
      if (isStarred) runs.unshift(new TextRun({ text: "⭐ ", size: 40 }));
      paragraphs.push(new Paragraph({
        children: runs,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }));
    } else if (tag === 'H2') {
      const runs = parseInline(node, { bold: true, size: 32 });
      if (isStarred) runs.unshift(new TextRun({ text: "⭐ ", size: 32 }));
      paragraphs.push(new Paragraph({
        children: runs,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
      }));
    } else if (tag === 'H3') {
      const runs = parseInline(node, { bold: true, size: 28 });
      if (isStarred) runs.unshift(new TextRun({ text: "⭐ ", size: 28 }));
      paragraphs.push(new Paragraph({
        children: runs,
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 140, after: 60 },
      }));
    } else if (tag === 'BLOCKQUOTE') {
      const runs = parseInline(node, { italics: true });
      if (isStarred) runs.unshift(new TextRun({ text: "⭐ " }));
      paragraphs.push(new Paragraph({
        children: runs,
        indent: { left: 720 },
        shading: { fill: "F8FAFC" },
        spacing: { before: 120, after: 120 },
      }));
    } else if (tag === 'HR') {
      paragraphs.push(new Paragraph({
        border: {
          bottom: { color: "CCCCCC", space: 1, value: "single", size: 6 }
        },
        spacing: { before: 200, after: 200 },
      }));
    } else if (tag === 'UL' || tag === 'OL') {
      const isChecklist = node.classList.contains('checklist');
      let index = 1;
      
      for (const li of node.childNodes) {
        if (li.nodeType !== 1 || li.tagName.toUpperCase() !== 'LI') continue;
        const liStarred = li.getAttribute?.('data-star') === 'true';
        const isChecked = li.getAttribute?.('data-checked') === 'true';
        const runs = parseInline(li);
        
        if (isChecklist) {
          const prefix = isChecked ? "☑  " : "☐  ";
          runs.unshift(new TextRun({ text: prefix, bold: true, color: "06B6D4" }));
        }
        if (liStarred) {
          runs.unshift(new TextRun({ text: "⭐  " }));
        }
        
        if (tag === 'UL' && !isChecklist) {
          paragraphs.push(new Paragraph({
            children: runs,
            bullet: { level: 0 },
            spacing: { after: 60 },
          }));
        } else if (tag === 'OL') {
          runs.unshift(new TextRun({ text: `${index}. ` }));
          paragraphs.push(new Paragraph({
            children: runs,
            indent: { left: 360 },
            spacing: { after: 60 },
          }));
          index++;
        } else { // Checklist
          paragraphs.push(new Paragraph({
            children: runs,
            indent: { left: 360 },
            spacing: { after: 60 },
          }));
        }
      }
    } else {
      // Fallback block container
      const runs = parseInline(node);
      if (isStarred) runs.unshift(new TextRun({ text: "⭐ " }));
      paragraphs.push(new Paragraph({
        children: runs,
        spacing: { after: 120 },
      }));
    }
  }

  for (const child of body.childNodes) {
    processNode(child);
  }

  flushAccumulated();

  return paragraphs;
}

/**
 * Triggers browser download of a note as a Word document.
 * @param {Object} note - The note database object
 */
export async function exportNoteToDocx(note) {
  if (!note) return;

  const formattedDate = note.updated_at 
    ? new Date(note.updated_at).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

  const contentParagraphs = parseHTMLToDocxParagraphs(note.content);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Large Note Title
          new Paragraph({
            children: [
              new TextRun({
                text: note.title || 'Sans titre',
                bold: true,
                size: 56, // 28pt
                font: "Calibri",
                color: "0F172A",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          }),
          // Last updated subtitle
          new Paragraph({
            children: [
              new TextRun({
                text: `Dernière modification : ${formattedDate}`,
                italics: true,
                size: 19, // 9.5pt
                font: "Calibri",
                color: "64748B",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
          }),
          // Elegant grey separator line
          new Paragraph({
            border: {
              bottom: { color: "E2E8F0", space: 1, value: "single", size: 6 }
            },
            spacing: { after: 300 },
          }),
          // Main content paragraphs
          ...contentParagraphs
        ],
      },
    ],
  });

  // Pack the document and download it in the browser
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  // Format filename cleanly
  const filename = (note.title || 'Note').replace(/[/\\?%*:|"<>\s]+/g, '_');
  link.download = `${filename}.docx`;
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
