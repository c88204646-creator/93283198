
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
  },
  {
    name: 'create_client',
    description: 'Crea un nuevo cliente en el sistema',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre del cliente' },
        email: { type: 'string', description: 'Email del cliente' },
        phone: { type: 'string', description: 'Teléfono del cliente' },
        company: { type: 'string', description: 'Empresa del cliente' },
        address: { type: 'string', description: 'Dirección del cliente' },
        rfc: { type: 'string', description: 'RFC fiscal del cliente' },
        razonSocial: { type: 'string', description: 'Razón social del cliente' }
      },
      required: ['name', 'email']
    }
  },
  {
    name: 'update_client',
    description: 'Actualiza la información de un cliente existente',
    parameters: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'ID del cliente a actualizar' },
        name: { type: 'string', description: 'Nombre del cliente' },
        email: { type: 'string', description: 'Email del cliente' },
        phone: { type: 'string', description: 'Teléfono del cliente' },
        company: { type: 'string', description: 'Empresa del cliente' },
        address: { type: 'string', description: 'Dirección del cliente' },
        status: { type: 'string', enum: ['active', 'inactive', 'potential'] }
      },
      required: ['clientId']
    }
  },
  {
    name: 'create_operation',
    description: 'Crea una nueva operación logística',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre/código de la operación' },
        clientId: { type: 'string', description: 'ID del cliente' },
        type: { type: 'string', enum: ['import', 'export', 'domestic', 'storage', 'customs', 'other'] },
        status: { type: 'string', enum: ['planning', 'in-progress', 'completed', 'cancelled'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        description: { type: 'string', description: 'Descripción de la operación' }
      },
      required: ['name', 'clientId']
    }
  },
  {
    name: 'create_employee',
    description: 'Crea un nuevo empleado en el sistema',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre del empleado' },
        email: { type: 'string', description: 'Email del empleado' },
        position: { type: 'string', description: 'Puesto del empleado' },
        department: { type: 'string', description: 'Departamento del empleado' },
        phone: { type: 'string', description: 'Teléfono del empleado' }
      },
      required: ['name', 'email', 'position']
    }
  },
  {
    name: 'update_employee',
    description: 'Actualiza la información de un empleado existente',
    parameters: {
      type: 'object',
      properties: {
        employeeId: { type: 'string', description: 'ID del empleado a actualizar' },
        name: { type: 'string', description: 'Nombre del empleado' },
        email: { type: 'string', description: 'Email del empleado' },
        position: { type: 'string', description: 'Puesto del empleado' },
        department: { type: 'string', description: 'Departamento del empleado' },
        status: { type: 'string', enum: ['active', 'on-leave', 'terminated'] }
      },
      required: ['employeeId']
    }
  },
  {
    name: 'create_expense',
    description: 'Registra un nuevo gasto',
    parameters: {
      type: 'object',
      properties: {
        operationId: { type: 'string', description: 'ID de la operación relacionada' },
        category: { type: 'string', description: 'Categoría del gasto' },
        amount: { type: 'number', description: 'Monto del gasto' },
        currency: { type: 'string', description: 'Moneda (USD, MXN, EUR, etc.)' },
        description: { type: 'string', description: 'Descripción del gasto' },
        date: { type: 'string', description: 'Fecha del gasto (formato ISO)' }
      },
      required: ['operationId', 'category', 'amount', 'description']
    }
  },
  {
    name: 'update_expense',
    description: 'Actualiza un gasto existente',
    parameters: {
      type: 'object',
      properties: {
        expenseId: { type: 'string', description: 'ID del gasto a actualizar' },
        category: { type: 'string', description: 'Categoría del gasto' },
        amount: { type: 'number', description: 'Monto del gasto' },
        status: { type: 'string', enum: ['pending', 'approved', 'paid', 'rejected'] }
      },
      required: ['expenseId']
    }
  },
  {
    name: 'create_lead',
    description: 'Crea un nuevo lead/prospecto',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre del lead' },
        email: { type: 'string', description: 'Email del lead' },
        phone: { type: 'string', description: 'Teléfono del lead' },
        company: { type: 'string', description: 'Empresa del lead' },
        source: { type: 'string', description: 'Fuente del lead (web, referral, etc.)' },
        notes: { type: 'string', description: 'Notas sobre el lead' }
      },
      required: ['name']
    }
  },
  {
    name: 'update_lead',
    description: 'Actualiza un lead existente',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID del lead a actualizar' },
        status: { type: 'string', enum: ['new', 'contacted', 'qualified', 'converted', 'lost'] },
        notes: { type: 'string', description: 'Notas sobre el lead' }
      },
      required: ['leadId']
    }
  },
  {
    name: 'create_task',
    description: 'Crea una nueva tarea en una operación',
    parameters: {
      type: 'object',
      properties: {
        operationId: { type: 'string', description: 'ID de la operación' },
        title: { type: 'string', description: 'Título de la tarea' },
        description: { type: 'string', description: 'Descripción de la tarea' },
        status: { type: 'string', enum: ['pending', 'in-progress', 'completed', 'cancelled'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] }
      },
      required: ['operationId', 'title']
    }
  },
  {
    name: 'update_task',
    description: 'Actualiza una tarea existente',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'ID de la tarea a actualizar' },
        status: { type: 'string', enum: ['pending', 'in-progress', 'completed', 'cancelled'] },
        title: { type: 'string', description: 'Título de la tarea' },
        description: { type: 'string', description: 'Descripción de la tarea' }
      },
      required: ['taskId']
    }
  }
];

export type ToolName = typeof geminiTools[number]['name'];
