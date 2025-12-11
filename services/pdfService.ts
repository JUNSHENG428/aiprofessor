import { ParsedPage } from '../types';

export const parsePDF = async (file: File): Promise<ParsedPage[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      if (!window.pdfjsLib) {
        reject(new Error("PDF.js library not loaded"));
        return;
      }

      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const parsedPages: ParsedPage[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        
        // 1. Extract Text
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map((item: any) => item.str);
        const pageText = textItems.join(' ');

        // 2. Render Image (for Vision capabilities)
        // Scale 2.0 for better chart/diagram recognition
        // Higher scale = clearer images for AI vision analysis
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // Use better rendering quality
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = 'high';

          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;

          // Convert to high-quality JPEG for better AI recognition
          const image = canvas.toDataURL('image/jpeg', 0.92);

          parsedPages.push({
            pageNumber: i,
            text: pageText,
            image: image
          });
        } else {
          parsedPages.push({
            pageNumber: i,
            text: pageText
          });
        }
      }

      resolve(parsedPages);
    } catch (error) {
      console.error("Error parsing PDF:", error);
      reject(error);
    }
  });
};