
import { z } from 'zod';

// Definición de herramientas que Gemini puede usar
export const geminiTools = [
  {
    name: 'get_operations',
    description: 'Obtiene la lista de operaciones. Puede filtrar por estado, cliente o buscar por nombre.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Estado de la operación: planning, in-progress, completed, cancelled',
          enum: ['planning', 'in-progress', 'completed', 'cancelled']
        },
        clientId: {
          type: 'string',
          description: 'ID del cliente para filtrar operaciones'
        },
        search: {
          type: 'string',
          description: 'Texto para buscar en nombre o descripción'
        }
      }
    }
  },
  {
    name: 'get_operation_detail',
    description: 'Obtiene los detalles completos de una operación específica por su ID',
    parameters: {
      type: 'object',
      properties: {
        operationId: {
          type: 'string',
          description: 'ID de la operación'
        }
      },
      required: ['operationId']
    }
  },
  {
    name: 'update_operation',
    description: 'Actualiza los datos de una operación existente',
    parameters: {
      type: 'object',
      properties: {
        operationId: {
          type: 'string',
          description: 'ID de la operación a actualizar'
        },
        status: {
          type: 'string',
          enum: ['planning', 'in-progress', 'completed', 'cancelled']
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent']
        },
        notes: {
          type: 'string',
          description: 'Notas adicionales'
        }
      },
      required: ['operationId']
    }
  },
  {
    name: 'get_clients',
    description: 'Obtiene la lista de clientes. Puede buscar por nombre o email.',
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Texto para buscar en nombre o email'
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'potential']
        }
      }
    }
  },
  {
    name: 'get_employees',
    description: 'Obtiene la lista de empleados',
    parameters: {
      type: 'object',
      properties: {
        department: {
          type: 'string',
          description: 'Filtrar por departamento'
        },
        status: {
          type: 'string',
          enum: ['active', 'on-leave', 'terminated']
        }
      }
    }
  },
  {
    name: 'get_invoices',
    description: 'Obtiene la lista de facturas con filtros opcionales',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled']
        },
        clientId: {
          type: 'string',
          description: 'ID del cliente'
        }
      }
    }
  },
  {
    name: 'create_operation_note',
    description: 'Crea una nota en una operación específica',
    parameters: {
      type: 'object',
      properties: {
        operationId: {
          type: 'string',
          description: 'ID de la operación'
        },
        content: {
          type: 'string',
          description: 'Contenido de la nota'
        }
      },
      required: ['operationId', 'content']
    }
  },
  {
    name: 'get_dashboard_stats',
    description: 'Obtiene estadísticas generales del dashboard',
    parameters: {
      type: 'object',
      properties: {}
    }
  }
];

export type ToolName = typeof geminiTools[number]['name'];
