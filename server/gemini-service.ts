
import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from './storage';
import type { ToolName } from '@shared/gemini-tools';
import { geminiTools } from '@shared/gemini-tools';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

export class GeminiService {
  private model;
  
  constructor() {
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      systemInstruction: `Eres un asistente virtual inteligente para LogistiCore, un sistema de gestión logística y freight forwarding. 

TU MISIÓN: Ayudar a los usuarios con operaciones, clientes, empleados, facturas y tareas del sistema de forma rápida, inteligente y proactiva.

🔍 BÚSQUEDA INTELIGENTE DE OPERACIONES:
- Cuando el usuario mencione números (ej: "0051", "51", "operación 0051"), SIEMPRE busca operaciones primero
- Usa el parámetro 'search' para buscar por nombre, código, referencia o descripción
- Sé flexible: "0051" puede estar en el nombre como "NAVI-0051" o "OP-0051"
- Si encuentras múltiples coincidencias, muéstralas todas
- Si no encuentras coincidencias exactas, busca coincidencias parciales

💡 COMPORTAMIENTO PROACTIVO:
- Anticípate a las necesidades del usuario
- Ofrece información relevante sin que te la pidan
- Si preguntan por una operación, muestra su estado, tareas pendientes y notas recientes
- Si hay problemas o alertas, menciónalos
- Sugiere acciones útiles basadas en el contexto

✅ RESPUESTAS RÁPIDAS Y ÚTILES:
- Sé conciso pero completo
- Usa emojis ocasionales para claridad (📦 operaciones, 📋 tareas, 📝 notas, ⚠️ alertas)
- Prioriza la información más importante
- Formatea respuestas para fácil lectura

🎯 CONSULTAS IMPRECISAS:
- Entiende lenguaje natural ("ayuda con la operación 51", "qué pasa con el envío 0051")
- No pidas precisión excesiva, busca la mejor coincidencia
- Si hay ambigüedad, muestra opciones en lugar de pedir aclaración

⚙️ HERRAMIENTAS DISPONIBLES:
- get_operations: Buscar y filtrar operaciones
- get_operation_detail: Detalles completos de una operación
- update_operation: Actualizar estados y datos
- create_operation_note: Agregar notas
- get_clients, get_employees, get_invoices: Datos del sistema
- get_dashboard_stats: Estadísticas generales

🔐 REGLAS:
- Confirma antes de cambios importantes (actualizar estados, crear notas)
- SIEMPRE responde en español
- Si no tienes información, di "No encontré..." y ofrece alternativas
- Usa herramientas automáticamente cuando detectes que el usuario necesita datos
- Muestra lo que estás haciendo: "🔍 Buscando operación 0051..."

RECUERDA: Sé el mejor asistente de logística, rápido, inteligente y útil.`
    });
  }

  async executeToolCall(toolName: string, parameters: Record<string, any>, userId: string): Promise<any> {
    console.log(`[Gemini] Executing tool: ${toolName}`, parameters);

    try {
      switch (toolName) {
        case 'get_operations': {
          const operations = await storage.getAllOperations();
          let filtered = operations;
          
          if (parameters.status) {
            filtered = filtered.filter(op => op.status === parameters.status);
          }
          if (parameters.clientId) {
            filtered = filtered.filter(op => op.clientId === parameters.clientId);
          }
          if (parameters.search) {
            const search = parameters.search.toLowerCase().trim();
            filtered = filtered.filter(op => {
              // Búsqueda flexible: nombre, descripción, referencias
              const name = op.name.toLowerCase();
              const desc = op.description?.toLowerCase() || '';
              const reference = op.reference?.toLowerCase() || '';
              
              // Coincidencia directa
              if (name.includes(search) || desc.includes(search) || reference.includes(search)) {
                return true;
              }
              
              // Búsqueda por números: "0051" debe encontrar "NAVI-0051" o "OP-0051"
              if (/^\d+$/.test(search)) {
                const numPattern = search.replace(/^0+/, ''); // "0051" -> "51"
                return name.includes(search) || 
                       name.includes(numPattern) || 
                       reference.includes(search) ||
                       reference.includes(numPattern);
              }
              
              return false;
            });
          }
          
          // Limitar resultados para no sobrecargar
          return filtered.slice(0, 50);
        }

        case 'get_operation_detail': {
          const operation = await storage.getOperation(parameters.operationId);
          if (!operation) return { error: 'Operación no encontrada' };
          
          const [employees, notes, tasks] = await Promise.all([
            storage.getOperationEmployees(parameters.operationId),
            storage.getOperationNotes(parameters.operationId),
            storage.getOperationTasks(parameters.operationId)
          ]);
          
          return { ...operation, employees, notes, tasks };
        }

        case 'update_operation': {
          const { operationId, ...updates } = parameters;
          const updated = await storage.updateOperation(operationId, updates);
          return updated;
        }

        case 'get_clients': {
          const clients = await storage.getAllClients();
          let filtered = clients;
          
          if (parameters.search) {
            const search = parameters.search.toLowerCase();
            filtered = filtered.filter(c => 
              c.name.toLowerCase().includes(search) || 
              c.email.toLowerCase().includes(search)
            );
          }
          if (parameters.status) {
            filtered = filtered.filter(c => c.status === parameters.status);
          }
          
          return filtered;
        }

        case 'get_employees': {
          const employees = await storage.getAllEmployees();
          let filtered = employees;
          
          if (parameters.department) {
            filtered = filtered.filter(e => e.department === parameters.department);
          }
          if (parameters.status) {
            filtered = filtered.filter(e => e.status === parameters.status);
          }
          
          return filtered;
        }

        case 'get_invoices': {
          const invoices = await storage.getAllInvoices();
          let filtered = invoices;
          
          if (parameters.status) {
            filtered = filtered.filter(i => i.status === parameters.status);
          }
          if (parameters.clientId) {
            filtered = filtered.filter(i => i.clientId === parameters.clientId);
          }
          
          return filtered;
        }

        case 'create_operation_note': {
          const note = await storage.createOperationNote({
            operationId: parameters.operationId,
            userId: userId,
            content: parameters.content
          });
          return note;
        }

        case 'get_dashboard_stats': {
          const stats = await storage.getDashboardStats();
          return stats;
        }

        default:
          return { error: `Herramienta desconocida: ${toolName}` };
      }
    } catch (error) {
      console.error(`[Gemini] Error executing tool ${toolName}:`, error);
      return { error: `Error al ejecutar ${toolName}: ${error.message}` };
    }
  }

  async chat(messages: Message[], userId: string): Promise<string> {
    try {
      const chat = this.model.startChat({
        history: messages.slice(0, -1).map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })),
        tools: [{
          functionDeclarations: geminiTools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }))
        }]
      });

      const lastMessage = messages[messages.length - 1].content;
      let result = await chat.sendMessage(lastMessage);
      let response = result.response;

      // Manejar llamadas a herramientas
      while (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        console.log(`[Gemini] Function call: ${functionCall.name}`);
        
        const functionResponse = await this.executeToolCall(
          functionCall.name,
          functionCall.args,
          userId
        );

        result = await chat.sendMessage([{
          functionResponse: {
            name: functionCall.name,
            response: functionResponse
          }
        }]);
        response = result.response;
      }

      return response.text();
    } catch (error) {
      console.error('[Gemini] Chat error:', error);
      throw new Error('Error al procesar el mensaje con Gemini');
    }
  }
}

export const geminiService = new GeminiService();
