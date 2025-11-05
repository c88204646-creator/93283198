
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
      systemInstruction: `Eres un asistente virtual inteligente para un sistema de gestión logística. 
      
Tu objetivo es ayudar a los usuarios con sus operaciones, clientes, empleados, facturas y otras tareas del sistema.

Capacidades:
- Consultar información sobre operaciones, clientes, empleados, facturas
- Actualizar estados de operaciones
- Crear notas en operaciones
- Proporcionar estadísticas y análisis
- Responder preguntas sobre el sistema

Comportamiento:
- Sé conciso y profesional
- Pregunta si necesitas más información
- Confirma antes de hacer cambios importantes
- Proporciona respuestas en español
- Si no tienes acceso a cierta información, dilo claramente

Cuando uses herramientas, siempre explica qué estás haciendo.`
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
            const search = parameters.search.toLowerCase();
            filtered = filtered.filter(op => 
              op.name.toLowerCase().includes(search) || 
              op.description?.toLowerCase().includes(search)
            );
          }
          
          return filtered;
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
