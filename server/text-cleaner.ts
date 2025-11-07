/**
 * Utilidad para limpiar y transformar texto conversacional en contenido profesional
 * Usado para mejorar tareas y notas existentes
 */

export class TextCleaner {
  /**
   * Limpia texto de conversaciones y lo transforma a contenido profesional
   */
  static cleanConversationalText(text: string): string {
    if (!text || text.trim().length === 0) {
      return text;
    }

    let cleaned = text;

    // 1. Eliminar saludos completos (al inicio o en medio)
    cleaned = cleaned.replace(/(^|\s)(buen[ao]s?\s+(dia|tarde|noche|dias)|hola|hello|hi|dear|estimad[ao])\s+[a-z]+(\s|,|:)/gi, ' ');
    
    // 2. Eliminar frases conversacionales comunes y transformarlas
    cleaned = cleaned
      .replace(/ya\s+(solicite|solicité|envie|envié|mande|mandé)/gi, 'Solicitado')
      .replace(/en\s+cuanto\s+(la|lo|los|las)\s+(tenga|reciba|tengamos|recibamos)/gi, 'Pendiente de recibir')
      .replace(/te\s+(la|lo|los|las)\s+(comparto|envio|envío|mando)/gi, 'para compartir')
      .replace(/nos\s+ayudas?\s+(con|a)/gi, 'Requerido')
      .replace(/por\s+favor/gi, '')
      .replace(/quedo\s+atent[ao].*/gi, '')
      .replace(/quedamos?\s+(a\s+la\s+orden|al\s+pendiente).*/gi, '')
      .replace(/\/\s*I[''']ll?\s+pending.*/gi, '')
      .replace(/best\s+regards.*/gi, '')
      .replace(/atentamente.*/gi, '')
      .replace(/saludos.*/gi, '')
      .replace(/regards.*/gi, '');
    
    // 3. Convertir referencias informales a formales
    cleaned = cleaned
      .replace(/\bal\s+AA\b/gi, 'al agente aduanal')
      .replace(/\bAA\b/gi, 'Agente aduanal');
    
    // 4. Eliminar frases que terminan con ":"
    cleaned = cleaned.replace(/según\s+correo\s+de\s+la\s+naviera:/gi, '. Confirmado por naviera.');
    
    // 5. Limpiar espacios múltiples y puntuación
    cleaned = cleaned
      .replace(/\s+/g, ' ')
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .replace(/\.+/g, '.')
      .trim();
    
    // 6. Capitalizar primera letra
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // 7. Asegurar que termina con punto si no tiene puntuación final
    if (cleaned.length > 0 && !cleaned.match(/[.!?]$/)) {
      cleaned += '.';
    }

    return cleaned;
  }

  /**
   * Limpia el título/contenido de una tarea
   */
  static cleanTaskTitle(title: string): string {
    let cleaned = this.cleanConversationalText(title);
    
    // Limitar longitud
    if (cleaned.length > 100) {
      cleaned = cleaned.substring(0, 97) + '...';
    }
    
    return cleaned;
  }

  /**
   * Limpia la descripción de una tarea
   */
  static cleanTaskDescription(description: string | null | undefined): string | null {
    if (!description) return null;
    
    let cleaned = this.cleanConversationalText(description);
    
    // Si queda muy corto después de limpiar, retornar null
    if (cleaned.length < 10) {
      return null;
    }
    
    // Limitar longitud
    if (cleaned.length > 200) {
      cleaned = cleaned.substring(0, 197) + '...';
    }
    
    return cleaned;
  }

  /**
   * Limpia el contenido de una nota
   */
  static cleanNoteContent(content: string): string {
    let cleaned = this.cleanConversationalText(content);
    
    // Si queda muy corto después de limpiar, generar contenido genérico
    if (cleaned.length < 20) {
      return 'Comunicación registrada.';
    }
    
    // Limitar longitud
    if (cleaned.length > 300) {
      cleaned = cleaned.substring(0, 297) + '...';
    }
    
    return cleaned;
  }
}
