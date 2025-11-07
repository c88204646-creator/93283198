/**
 * Utilidad para interpretar y transformar texto conversacional en contenido profesional
 * Usado para mejorar tareas y notas existentes
 */

export class TextCleaner {
  /**
   * Limpia texto ELIMINANDO toda conversación y dejando solo datos clave
   */
  static cleanConversationalText(text: string): string {
    if (!text || text.trim().length === 0) {
      return text;
    }

    let cleaned = text;

    // 1. Eliminar saludos COMPLETOS (ej: "Buen dia Alexis")
    cleaned = cleaned.replace(/^(buen[ao]s?\s+(dia|tarde|noche|dias)\s+[a-z]+|hola\s+[a-z]+|hello\s+[a-z]+|dear\s+[a-z]+|estimad[ao]\s+[a-z]+)/gi, '');
    
    // 2. Eliminar frases conversacionales completas
    cleaned = cleaned
      .replace(/nos\s+ayudas?\s+(con|a)\s+(la|el|los|las)\s+/gi, '')
      .replace(/ya\s+(solicite|solicité|envie|envié|mande|mandé)/gi, 'Solicitado')
      .replace(/en\s+cuanto\s+(la|lo|los|las)\s+(tenga|reciba)/gi, 'Pendiente de recibir')
      .replace(/te\s+(la|lo|los|las)\s+(comparto|envio|envío|mando)/gi, 'para enviar')
      .replace(/por\s+favor/gi, '')
      .replace(/quedo\s+atent[ao].*/gi, '')
      .replace(/quedamos?\s+al?\s+(la\s+orden|pendiente).*/gi, '')
      .replace(/\/\s*I[''']ll?\s+pending.*/gi, '')
      .replace(/best\s+regards.*/gi, '')
      .replace(/atentamente.*/gi, '')
      .replace(/saludos.*/gi, '')
      .replace(/regards.*/gi, '')
      .replace(/este\s+contenedor\s+/gi, 'Contenedor ')
      .replace(/según\s+(correo\s+de\s+)?la\s+naviera:?/gi, '. Confirmado por naviera.');
    
    // 3. Convertir referencias informales
    cleaned = cleaned
      .replace(/\bal\s+AA\b/gi, 'al agente aduanal')
      .replace(/\bAA\b/gi, 'agente aduanal');
    
    // 4. Limpiar espacios múltiples y puntuación
    cleaned = cleaned
      .replace(/\s+/g, ' ')
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .replace(/\.+/g, '.')
      .replace(/\s+:/g, ':')
      .trim();
    
    // 5. Si queda muy corto o solo quedaron partículas, retornar mensaje genérico
    if (cleaned.length < 15 || cleaned.match(/^(Solicitado|Pendiente|para enviar)\.?$/i)) {
      return 'Comunicación registrada.';
    }
    
    // 6. Capitalizar primera letra
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // 7. Asegurar punto final
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
