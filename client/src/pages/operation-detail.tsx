import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  ArrowLeft, Package, FileText, CheckSquare, Mail, Edit2, Trash2, Plus,
  Calendar, User as UserIcon, MapPin, Ship, Plane, Truck, DollarSign
} from "lucide-react";
import { useState } from "react";
import type { Operation, OperationNote, OperationTask, Employee, User, Client, GmailMessage } from "@shared/schema";

export default function OperationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("info");

  const { data: operation, isLoading: operationLoading } = useQuery<Operation>({
    queryKey: ['/api/operations', id],
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<OperationNote[]>({
    queryKey: ['/api/operations', id, 'notes'],
    enabled: !!id,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<OperationTask[]>({
    queryKey: ['/api/operations', id, 'tasks'],
    enabled: !!id,
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: gmailMessages = [] } = useQuery<GmailMessage[]>({
    queryKey: ['/api/gmail/messages'],
  });

  if (operationLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Cargando operación...</div>
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Operación no encontrada</div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'on-hold': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getOperationTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'air': return <Plane className="w-4 h-4" />;
      case 'sea': case 'fcl': case 'lcl': return <Ship className="w-4 h-4" />;
      case 'road': case 'rail': return <Truck className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const client = clients.find(c => c.id === operation.clientId);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/operations')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold" data-testid="text-operation-name">{operation.name}</h1>
              <Badge className={getStatusColor(operation.status)} data-testid="badge-status">
                {operation.status}
              </Badge>
              {operation.priority && (
                <Badge className={getPriorityColor(operation.priority)} data-testid="badge-priority">
                  {operation.priority}
                </Badge>
              )}
            </div>
            {operation.description && (
              <p className="text-muted-foreground mt-1" data-testid="text-description">
                {operation.description}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/operations`)}
          data-testid="button-edit"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Editar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="info" data-testid="tab-info">
            <Package className="w-4 h-4 mr-2" />
            Información
          </TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">
            <FileText className="w-4 h-4 mr-2" />
            Notas
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <CheckSquare className="w-4 h-4 mr-2" />
            Tareas
          </TabsTrigger>
          <TabsTrigger value="emails" data-testid="tab-emails">
            <Mail className="w-4 h-4 mr-2" />
            Emails
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          <InformationTab operation={operation} client={client} employees={employees} />
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <NotesTab operationId={id!} notes={notes} users={users} />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <TasksTab operationId={id!} tasks={tasks} employees={employees} users={users} />
        </TabsContent>

        <TabsContent value="emails" className="space-y-4">
          <EmailsTab operationId={id!} operation={operation} gmailMessages={gmailMessages} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InformationTab({ operation, client, employees }: { operation: Operation; client?: Client; employees: Employee[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Cliente</Label>
            <p className="font-medium" data-testid="text-client">{client?.name || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Categoría del Proyecto</Label>
            <p className="font-medium" data-testid="text-category">{operation.projectCategory || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Tipo de Operación</Label>
            <p className="font-medium flex items-center gap-2" data-testid="text-operation-type">
              {operation.operationType && getOperationTypeIcon(operation.operationType)}
              {operation.operationType || 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground">Modo de Envío</Label>
            <p className="font-medium" data-testid="text-shipping-mode">{operation.shippingMode || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Moneda</Label>
            <p className="font-medium flex items-center gap-2" data-testid="text-currency">
              <DollarSign className="w-4 h-4" />
              {operation.currency || 'N/A'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalles de Envío</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Courier</Label>
            <p className="font-medium" data-testid="text-courier">{operation.courier || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Número de Reserva/Tracking</Label>
            <p className="font-medium" data-testid="text-tracking">{operation.bookingTrackingNumber || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">MBL/AWB</Label>
            <p className="font-medium" data-testid="text-mbl">{operation.mblAwb || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">HBL/AWB</Label>
            <p className="font-medium" data-testid="text-hbl">{operation.hblAwb || 'N/A'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Direcciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Dirección de Recogida
            </Label>
            <p className="font-medium" data-testid="text-pickup">{operation.pickUpAddress || 'N/A'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Dirección de Entrega
            </Label>
            <p className="font-medium" data-testid="text-delivery">{operation.deliveryAddress || 'N/A'}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fechas Importantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Fecha de Recogida
            </Label>
            <p className="font-medium" data-testid="text-pickup-date">
              {operation.pickUpDate ? format(new Date(operation.pickUpDate), 'PPP') : 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              ETD (Fecha Estimada de Salida)
            </Label>
            <p className="font-medium" data-testid="text-etd">
              {operation.etd ? format(new Date(operation.etd), 'PPP') : 'N/A'}
            </p>
          </div>
          <div>
            <Label className="text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              ETA (Fecha Estimada de Llegada)
            </Label>
            <p className="font-medium" data-testid="text-eta">
              {operation.eta ? format(new Date(operation.eta), 'PPP') : 'N/A'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NotesTab({ operationId, notes, users }: { operationId: string; notes: OperationNote[]; users: User[] }) {
  const { toast } = useToast();
  const [newNote, setNewNote] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest(`/api/operations/${operationId}/notes`, {
        method: 'POST',
        body: { content },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations', operationId, 'notes'] });
      setNewNote("");
      toast({ title: "Nota creada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al crear la nota", variant: "destructive" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      return apiRequest(`/api/operations/${operationId}/notes/${noteId}`, {
        method: 'PATCH',
        body: { content },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations', operationId, 'notes'] });
      setEditingNote(null);
      toast({ title: "Nota actualizada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar la nota", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest(`/api/operations/${operationId}/notes/${noteId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations', operationId, 'notes'] });
      toast({ title: "Nota eliminada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al eliminar la nota", variant: "destructive" });
    },
  });

  const handleCreateNote = () => {
    if (!newNote.trim()) return;
    createNoteMutation.mutate(newNote);
  };

  const handleUpdateNote = (noteId: string) => {
    if (!editContent.trim()) return;
    updateNoteMutation.mutate({ noteId, content: editContent });
  };

  const startEdit = (note: OperationNote) => {
    setEditingNote(note.id);
    setEditContent(note.content);
  };

  const cancelEdit = () => {
    setEditingNote(null);
    setEditContent("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Agregar Nueva Nota</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Escribe una nota..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={4}
            data-testid="input-new-note"
          />
          <Button
            onClick={handleCreateNote}
            disabled={createNoteMutation.isPending || !newNote.trim()}
            data-testid="button-create-note"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Nota
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {notes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay notas para esta operación
            </CardContent>
          </Card>
        ) : (
          notes.map((note) => {
            const user = users.find(u => u.id === note.userId);
            const isEditing = editingNote === note.id;

            return (
              <Card key={note.id} data-testid={`card-note-${note.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium" data-testid={`text-note-user-${note.id}`}>
                        {user?.username || 'Usuario'}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(note.createdAt), 'PPp')}
                      </span>
                    </div>
                    {!isEditing && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(note)}
                          data-testid={`button-edit-note-${note.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNoteMutation.mutate(note.id)}
                          data-testid={`button-delete-note-${note.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={4}
                        data-testid={`input-edit-note-${note.id}`}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdateNote(note.id)}
                          disabled={updateNoteMutation.isPending}
                          data-testid={`button-save-note-${note.id}`}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEdit}
                          data-testid={`button-cancel-note-${note.id}`}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap" data-testid={`text-note-content-${note.id}`}>
                      {note.content}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function TasksTab({ operationId, tasks, employees, users }: { 
  operationId: string; 
  tasks: OperationTask[]; 
  employees: Employee[];
  users: User[];
}) {
  const { toast } = useToast();
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: "pending",
    priority: "medium",
    assignedToId: "",
    dueDate: "",
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: typeof newTask) => {
      return apiRequest(`/api/operations/${operationId}/tasks`, {
        method: 'POST',
        body: taskData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations', operationId, 'tasks'] });
      setShowNewTask(false);
      setNewTask({
        title: "",
        description: "",
        status: "pending",
        priority: "medium",
        assignedToId: "",
        dueDate: "",
      });
      toast({ title: "Tarea creada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al crear la tarea", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<OperationTask> }) => {
      return apiRequest(`/api/operations/${operationId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: updates,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations', operationId, 'tasks'] });
      toast({ title: "Tarea actualizada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar la tarea", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest(`/api/operations/${operationId}/tasks/${taskId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations', operationId, 'tasks'] });
      toast({ title: "Tarea eliminada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al eliminar la tarea", variant: "destructive" });
    },
  });

  const handleCreateTask = () => {
    if (!newTask.title.trim()) {
      toast({ title: "El título es requerido", variant: "destructive" });
      return;
    }
    createTaskMutation.mutate(newTask);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      case 'in-progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      {!showNewTask ? (
        <Button onClick={() => setShowNewTask(true)} data-testid="button-new-task">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Tarea
        </Button>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Nueva Tarea</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Título de la tarea"
                  data-testid="input-task-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Asignado a</Label>
                <Select
                  value={newTask.assignedToId}
                  onValueChange={(value) => setNewTask({ ...newTask, assignedToId: value })}
                >
                  <SelectTrigger data-testid="select-task-assigned">
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin asignar</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={newTask.status}
                  onValueChange={(value) => setNewTask({ ...newTask, status: value })}
                >
                  <SelectTrigger data-testid="select-task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="in-progress">En Progreso</SelectItem>
                    <SelectItem value="completed">Completada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                >
                  <SelectTrigger data-testid="select-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha de Vencimiento</Label>
                <Input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  data-testid="input-task-due-date"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Descripción de la tarea"
                rows={3}
                data-testid="input-task-description"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateTask}
                disabled={createTaskMutation.isPending}
                data-testid="button-save-task"
              >
                Crear Tarea
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowNewTask(false)}
                data-testid="button-cancel-task"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No hay tareas para esta operación
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => {
            const assignedEmployee = employees.find(e => e.id === task.assignedToId);
            const createdByUser = users.find(u => u.id === task.createdById);

            return (
              <Card key={task.id} data-testid={`card-task-${task.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle data-testid={`text-task-title-${task.id}`}>{task.title}</CardTitle>
                        <Badge className={getStatusColor(task.status)} data-testid={`badge-task-status-${task.id}`}>
                          {task.status}
                        </Badge>
                        <Badge className={getPriorityColor(task.priority)} data-testid={`badge-task-priority-${task.id}`}>
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <CardDescription data-testid={`text-task-description-${task.id}`}>
                          {task.description}
                        </CardDescription>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                        {assignedEmployee && (
                          <div className="flex items-center gap-1">
                            <UserIcon className="w-3 h-3" />
                            <span>{assignedEmployee.name}</span>
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{format(new Date(task.dueDate), 'PP')}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span>Creada por {createdByUser?.username || 'Usuario'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newStatus = task.status === 'completed' ? 'pending' : 'completed';
                          updateTaskMutation.mutate({
                            taskId: task.id,
                            updates: { 
                              status: newStatus,
                              completedAt: newStatus === 'completed' ? new Date().toISOString() : null
                            }
                          });
                        }}
                        data-testid={`button-toggle-task-${task.id}`}
                      >
                        <CheckSquare className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTaskMutation.mutate(task.id)}
                        data-testid={`button-delete-task-${task.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function EmailsTab({ operationId, operation, gmailMessages }: { 
  operationId: string; 
  operation: Operation;
  gmailMessages: GmailMessage[];
}) {
  const relatedEmails = gmailMessages.filter(msg => {
    const searchText = `${msg.subject} ${msg.from} ${msg.snippet}`.toLowerCase();
    const operationName = operation.name.toLowerCase();
    const bookingNumber = operation.bookingTrackingNumber?.toLowerCase();
    
    return searchText.includes(operationName) || 
           (bookingNumber && searchText.includes(bookingNumber));
  });

  return (
    <div className="space-y-3">
      {relatedEmails.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No se encontraron emails relacionados con esta operación
          </CardContent>
        </Card>
      ) : (
        relatedEmails.map((email) => (
          <Card key={email.id} data-testid={`card-email-${email.id}`} className="hover-elevate">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-lg" data-testid={`text-email-subject-${email.id}`}>
                    {email.subject}
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      <span data-testid={`text-email-from-${email.id}`}>{email.from}</span>
                    </div>
                    <span>{format(new Date(email.date), 'PPp')}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground" data-testid={`text-email-snippet-${email.id}`}>
                {email.snippet}
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
