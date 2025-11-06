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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  ArrowLeft, Package, FileText, CheckSquare, Mail, Edit2, Trash2, Plus,
  Calendar, User as UserIcon, MapPin, Ship, Plane, Truck, DollarSign, FolderOpen,
  Download, Paperclip, Upload, Link, FileIcon, Image, ExternalLink, Eye
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import DOMPurify from 'isomorphic-dompurify';
import type { Operation, OperationNote, OperationTask, Employee, User, Client, GmailMessage } from "@shared/schema";
import { ObjectUploader } from "@/components/ObjectUploader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

export default function OperationDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("info");

  const { data: operation, isLoading: operationLoading, isError } = useQuery<Operation>({
    queryKey: [`/api/operations/${id}`],
    enabled: !!id,
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<OperationNote[]>({
    queryKey: [`/api/operations/${id}/notes`],
    enabled: !!id && !!operation,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<OperationTask[]>({
    queryKey: [`/api/operations/${id}/tasks`],
    enabled: !!id && !!operation,
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

  if (operationLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-lg font-medium text-muted-foreground">Cargando operación...</div>
        </div>
      </div>
    );
  }

  if (isError || !operation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <div className="text-xl font-semibold mb-2">Operación no encontrada</div>
          <Button variant="outline" onClick={() => navigate('/operations')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Operaciones
          </Button>
        </div>
      </div>
    );
  }

  const client = clients.find(c => c.id === operation.clientId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6 max-w-7xl">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground px-2">
          <button
            onClick={() => navigate('/')}
            className="hover:text-foreground transition-colors"
            data-testid="button-breadcrumb-home"
          >
            Inicio
          </button>
          <span>/</span>
          <button
            onClick={() => navigate('/operations')}
            className="hover:text-foreground transition-colors"
            data-testid="button-breadcrumb-operations"
          >
            Operaciones
          </button>
          <span>/</span>
          <span className="text-foreground font-medium truncate max-w-xs" data-testid="text-breadcrumb-current">
            {operation.name}
          </span>
        </nav>

        {/* Header mejorado con gradiente */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4 md:p-8 shadow-xl backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -ml-24 -mb-24" />
          
          <div className="relative flex flex-col md:flex-row items-start gap-4 md:gap-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/operations')}
              data-testid="button-back"
              className="shrink-0 bg-background/50 backdrop-blur-sm hover:bg-background/80 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            <div className="flex-1 space-y-4 w-full">
              <div className="flex items-start gap-2 md:gap-4 flex-wrap">
                <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  {getOperationTypeIcon(operation.operationType)}
                  <span className="text-sm font-medium">{operation.operationType}</span>
                </div>
                <Badge className={`${getStatusColor(operation.status)} text-xs md:text-sm px-2 md:px-3 py-1`} data-testid="badge-status">
                  {operation.status === 'planning' ? 'Planificación' : 
                   operation.status === 'in-progress' ? 'En Progreso' : 
                   operation.status === 'completed' ? 'Completado' : 
                   'Cancelado'}
                </Badge>
                {operation.priority && (
                  <Badge className={`${getPriorityColor(operation.priority)} text-xs md:text-sm px-2 md:px-3 py-1`} data-testid="badge-priority">
                    {operation.priority === 'low' ? 'Baja' : 
                     operation.priority === 'medium' ? 'Media' : 
                     operation.priority === 'high' ? 'Alta' : 
                     'Urgente'}
                  </Badge>
                )}
              </div>
              
              <div>
                <h1 className="text-2xl md:text-4xl font-bold tracking-tight mb-2" data-testid="text-operation-name">
                  {operation.name}
                </h1>
                {operation.description && (
                  <p className="text-muted-foreground text-sm md:text-lg max-w-3xl" data-testid="text-description">
                    {operation.description}
                  </p>
                )}
              </div>
              
              {client && (
                <div className="flex items-center gap-2 text-sm md:text-base text-muted-foreground">
                  <UserIcon className="w-4 h-4" />
                  <span className="font-medium">Cliente:</span>
                  <span className="truncate">{client.name}</span>
                </div>
              )}
            </div>
            
            <Button
              onClick={() => navigate(`/operations`)}
              data-testid="button-edit"
              className="shrink-0 w-full md:w-auto bg-primary/90 hover:bg-primary shadow-lg"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Editar Operación
            </Button>
          </div>
        </div>

        {/* Tabs mejorados */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1 bg-muted/50 backdrop-blur-sm rounded-xl">
            <TabsTrigger 
              value="info" 
              data-testid="tab-info"
              className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all py-3"
            >
              <Package className="w-4 h-4 mr-2" />
              <span className="font-medium">Información</span>
            </TabsTrigger>
            <TabsTrigger 
              value="notes" 
              data-testid="tab-notes"
              className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all py-3"
            >
              <FileText className="w-4 h-4 mr-2" />
              <span className="font-medium">Notas</span>
            </TabsTrigger>
            <TabsTrigger 
              value="tasks" 
              data-testid="tab-tasks"
              className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all py-3"
            >
              <CheckSquare className="w-4 h-4 mr-2" />
              <span className="font-medium">Tareas</span>
            </TabsTrigger>
            <TabsTrigger 
              value="files" 
              data-testid="tab-files"
              className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all py-3"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              <span className="font-medium">Archivos</span>
            </TabsTrigger>
            <TabsTrigger 
              value="emails" 
              data-testid="tab-emails"
              className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all py-3"
            >
              <Mail className="w-4 h-4 mr-2" />
              <span className="font-medium">Emails</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-6 animate-in fade-in-50 duration-300">
            <InformationTab operation={operation} client={client} employees={employees} />
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 mt-6 animate-in fade-in-50 duration-300">
            <NotesTab operationId={id!} notes={notes} users={users} />
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4 mt-6 animate-in fade-in-50 duration-300">
            <TasksTab operationId={id!} tasks={tasks} employees={employees} users={users} />
          </TabsContent>

          <TabsContent value="files" className="space-y-4 mt-6 animate-in fade-in-50 duration-300">
            <FilesTab operationId={id!} />
          </TabsContent>

          <TabsContent value="emails" className="space-y-4 mt-6 animate-in fade-in-50 duration-300">
            <EmailsTab operationId={id!} operation={operation} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InformationTab({ operation, client, employees }: { operation: Operation; client?: Client; employees: Employee[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
      <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg bg-gradient-to-br from-card to-card/50">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="w-5 h-5 text-primary" />
            Información General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <UserIcon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cliente</Label>
              <p className="font-semibold text-base mt-1" data-testid="text-client">{client?.name || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <FolderOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Categoría del Proyecto</Label>
              <p className="font-semibold text-base mt-1 capitalize" data-testid="text-category">
                {operation.projectCategory === 'import' ? 'Importación' :
                 operation.projectCategory === 'export' ? 'Exportación' :
                 operation.projectCategory === 'domestic' ? 'Nacional' :
                 operation.projectCategory === 'warehousing' ? 'Almacenamiento' :
                 operation.projectCategory === 'customs-clearance' ? 'Despacho Aduanal' :
                 operation.projectCategory || 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <div className="shrink-0 mt-0.5">
              {operation.operationType && getOperationTypeIcon(operation.operationType)}
            </div>
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tipo de Operación</Label>
              <p className="font-semibold text-base mt-1" data-testid="text-operation-type">
                {operation.operationType || 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <Ship className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Modo de Envío</Label>
              <p className="font-semibold text-base mt-1 capitalize" data-testid="text-shipping-mode">
                {operation.shippingMode === 'sea' ? 'Marítimo' :
                 operation.shippingMode === 'air' ? 'Aéreo' :
                 operation.shippingMode === 'land' ? 'Terrestre' :
                 operation.shippingMode === 'multimodal' ? 'Multimodal' :
                 operation.shippingMode || 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <DollarSign className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Moneda</Label>
              <p className="font-semibold text-base mt-1" data-testid="text-currency">
                {operation.projectCurrency || 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg bg-gradient-to-br from-card to-card/50">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Truck className="w-5 h-5 text-primary" />
            Detalles de Envío
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <Package className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Courier</Label>
              <p className="font-semibold text-base mt-1" data-testid="text-courier">{operation.courier || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <Link className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Número de Reserva/Tracking</Label>
              <p className="font-semibold text-base mt-1 font-mono" data-testid="text-tracking">{operation.bookingTracking || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">MBL/AWB</Label>
              <p className="font-semibold text-base mt-1 font-mono" data-testid="text-mbl">{operation.mblAwb || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">HBL/AWB</Label>
              <p className="font-semibold text-base mt-1 font-mono" data-testid="text-hbl">{operation.hblAwb || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg bg-gradient-to-br from-card to-card/50">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <MapPin className="w-5 h-5 text-primary" />
            Direcciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors">
            <MapPin className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                Dirección de Recogida
              </Label>
              <p className="font-medium text-sm mt-2 leading-relaxed" data-testid="text-pickup">
                {operation.pickUpAddress || 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
            <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                Dirección de Entrega
              </Label>
              <p className="font-medium text-sm mt-2 leading-relaxed" data-testid="text-delivery">
                {operation.deliveryAddress || 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-primary/20 hover:border-primary/40 transition-all hover:shadow-lg bg-gradient-to-br from-card to-card/50">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Calendar className="w-5 h-5 text-primary" />
            Fechas Importantes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <Calendar className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Fecha de Recogida</Label>
              <p className="font-semibold text-base mt-1" data-testid="text-pickup-date">
                {operation.pickUpDate ? format(new Date(operation.pickUpDate), 'PPP', { locale: require('date-fns/locale/es') }) : 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors">
            <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">ETD (Fecha Estimada de Salida)</Label>
              <p className="font-semibold text-base mt-1" data-testid="text-etd">
                {operation.etd ? format(new Date(operation.etd), 'PPP', { locale: require('date-fns/locale/es') }) : 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">ETA (Fecha Estimada de Llegada)</Label>
              <p className="font-semibold text-base mt-1" data-testid="text-eta">
                {operation.eta ? format(new Date(operation.eta), 'PPP', { locale: require('date-fns/locale/es') }) : 'N/A'}
              </p>
            </div>
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
      queryClient.invalidateQueries({ queryKey: [`/api/operations/${operationId}/notes`] });
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
      queryClient.invalidateQueries({ queryKey: [`/api/operations/${operationId}/notes`] });
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
      queryClient.invalidateQueries({ queryKey: [`/api/operations/${operationId}/notes`] });
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
    assignedToId: undefined as string | undefined,
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
      queryClient.invalidateQueries({ queryKey: [`/api/operations/${operationId}/tasks`] });
      setShowNewTask(false);
      setNewTask({
        title: "",
        description: "",
        status: "pending",
        priority: "medium",
        assignedToId: undefined,
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
      queryClient.invalidateQueries({ queryKey: [`/api/operations/${operationId}/tasks`] });
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
      queryClient.invalidateQueries({ queryKey: [`/api/operations/${operationId}/tasks`] });
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
                  value={newTask.assignedToId || "unassigned"}
                  onValueChange={(value) => setNewTask({ ...newTask, assignedToId: value === "unassigned" ? undefined : value })}
                >
                  <SelectTrigger data-testid="select-task-assigned">
                    <SelectValue placeholder="Seleccionar empleado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Sin asignar</SelectItem>
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

function EmailsTab({ operationId, operation }: { 
  operationId: string; 
  operation: Operation;
}) {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  
  // Use optimized endpoint to get messages directly linked to this operation
  const { data: relatedEmails = [], isLoading: isLoadingMessages } = useQuery<GmailMessage[]>({
    queryKey: ['/api/operations', operationId, 'messages'],
  });

  // Get full email content with signed URLs when a message is selected
  const { data: emailContent, isLoading: isLoadingContent } = useQuery<{
    htmlBodyUrl?: string;
    textBodyUrl?: string;
    attachments?: Array<{
      id: string;
      filename: string;
      mimeType: string;
      size: number;
      isInline: boolean;
      contentId?: string;
      signedUrl?: string;
    }>;
  }>({
    queryKey: ['/api/gmail/messages', selectedMessageId, 'content'],
    enabled: !!selectedMessageId,
  });

  // Group emails by date
  const groupedEmails = useMemo(() => {
    const groups: { [key: string]: GmailMessage[] } = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    relatedEmails.forEach((email) => {
      const emailDate = new Date(email.date);
      let groupKey: string;

      if (emailDate.toDateString() === today.toDateString()) {
        groupKey = 'Hoy';
      } else if (emailDate.toDateString() === yesterday.toDateString()) {
        groupKey = 'Ayer';
      } else {
        groupKey = format(emailDate, 'dd MMM yyyy');
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(email);
    });

    return groups;
  }, [relatedEmails]);

  const selectedMessage = relatedEmails.find(e => e.id === selectedMessageId);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  // Get file icon based on mime type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.includes('pdf')) return FileText;
    return FileIcon;
  };

  // Fetch HTML body content and sanitize
  const [htmlBodyContent, setHtmlBodyContent] = useState<string>('');
  const [textBodyContent, setTextBodyContent] = useState<string>('');

  useEffect(() => {
    const loadEmailBody = async () => {
      if (!emailContent) return;

      // Load HTML body from signed URL
      if (emailContent.htmlBodyUrl) {
        try {
          const response = await fetch(emailContent.htmlBodyUrl);
          let html = await response.text();
          
          // Replace CID references with signed URLs for inline images
          if (emailContent.attachments) {
            emailContent.attachments.forEach((attachment: any) => {
              if (attachment.isInline && attachment.contentId && attachment.signedUrl) {
                const cidPattern = new RegExp(`cid:${attachment.contentId.replace(/[<>]/g, '')}`, 'gi');
                html = html.replace(cidPattern, attachment.signedUrl);
              }
            });
          }
          
          // Sanitize HTML before rendering
          const cleanHtml = DOMPurify.sanitize(html, {
            ADD_TAGS: ['style'],
            ADD_ATTR: ['target', 'style', 'class'],
            ALLOW_DATA_ATTR: true,
          });
          
          setHtmlBodyContent(cleanHtml);
        } catch (error) {
          console.error('Error loading HTML body:', error);
        }
      }

      // Load text body from signed URL
      if (emailContent.textBodyUrl && !emailContent.htmlBodyUrl) {
        try {
          const response = await fetch(emailContent.textBodyUrl);
          const text = await response.text();
          setTextBodyContent(text);
        } catch (error) {
          console.error('Error loading text body:', error);
        }
      }
    };

    loadEmailBody();
  }, [emailContent]);

  // Mobile view check
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (relatedEmails.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground text-lg font-medium">
            No hay correos vinculados
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Los correos relacionados con esta operación aparecerán aquí
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-[calc(100vh-20rem)] flex flex-col md:flex-row gap-3">
      {/* Email List - Master Panel - Más compacto */}
      <div className={`${isMobile && selectedMessageId ? 'hidden' : 'flex'} flex-col w-full md:w-72 border rounded-lg bg-card overflow-hidden shadow-sm`}>
        <div className="px-3 py-2 border-b bg-muted/50">
          <h3 className="font-semibold text-xs flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
            <Mail className="w-3.5 h-3.5" />
            Correos Vinculados ({relatedEmails.length})
          </h3>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-1">
            {Object.entries(groupedEmails).map(([dateGroup, emails]) => (
              <div key={dateGroup} className="mb-2">
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {dateGroup}
                </div>
                <div className="space-y-0.5">
                  {emails.map((email) => {
                    const isSelected = email.id === selectedMessageId;
                    return (
                      <button
                        key={email.id}
                        data-testid={`button-email-${email.id}`}
                        onClick={() => setSelectedMessageId(email.id)}
                        className={`w-full text-left px-2 py-2 rounded-md transition-all ${
                          isSelected 
                            ? 'bg-primary text-primary-foreground' 
                            : 'hover:bg-accent'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {/* Avatar más pequeño */}
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/15 text-primary'
                          }`}>
                            {(email.fromName || email.fromEmail).charAt(0).toUpperCase()}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-1 mb-0.5">
                              <p className={`text-xs font-semibold truncate ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
                                {email.fromName || email.fromEmail.split('@')[0]}
                              </p>
                              <span className={`text-[10px] flex-shrink-0 ${isSelected ? 'opacity-90' : 'text-muted-foreground'}`}>
                                {format(new Date(email.date), 'HH:mm')}
                              </span>
                            </div>
                            
                            <p className={`text-xs font-medium truncate mb-1 ${isSelected ? 'opacity-95' : 'text-foreground'}`}>
                              {email.subject || '(Sin asunto)'}
                            </p>
                            
                            <p className={`text-[11px] line-clamp-1 ${isSelected ? 'opacity-75' : 'text-muted-foreground'}`}>
                              {email.snippet}
                            </p>
                            
                            {email.hasAttachments && (
                              <Paperclip className={`w-3 h-3 mt-1 ${isSelected ? 'opacity-70' : 'text-muted-foreground'}`} />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Email Viewer - Detail Panel */}
      <div className={`${isMobile && !selectedMessageId ? 'hidden' : 'flex'} flex-1 flex-col border rounded-lg bg-card overflow-hidden`}>
        {!selectedMessage ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div>
              <Eye className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground text-lg font-medium">
                Selecciona un correo
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Elige un correo de la lista para ver su contenido
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Email Header - Compacto y profesional */}
            <div className="px-4 py-3 border-b bg-muted/20">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedMessageId(null)}
                  className="mb-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
              )}
              
              <h2 className="text-lg font-bold mb-3" data-testid="text-email-subject">
                {selectedMessage.subject || '(Sin asunto)'}
              </h2>

              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {(selectedMessage.fromName || selectedMessage.fromEmail).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p className="font-semibold text-sm truncate" data-testid="text-from-name">
                      {selectedMessage.fromName || selectedMessage.fromEmail}
                    </p>
                    <span className="text-xs text-muted-foreground flex-shrink-0" data-testid="text-email-date">
                      {format(new Date(selectedMessage.date), 'dd MMM yyyy, HH:mm')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate" data-testid="text-from-email">
                    {selectedMessage.fromEmail}
                  </p>
                </div>
              </div>

              <div className="mt-2 text-xs space-y-0.5 text-muted-foreground">
                <div className="truncate">
                  <span className="font-medium">Para:</span> {selectedMessage.toEmails.join(', ')}
                </div>
                {selectedMessage.ccEmails && selectedMessage.ccEmails.length > 0 && (
                  <div className="truncate">
                    <span className="font-medium">CC:</span> {selectedMessage.ccEmails.join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* Email Body con scroll */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-4">
                {/* Contenido del correo */}
                {isLoadingContent ? (
                  <div className="space-y-3">
                    <div className="h-4 bg-muted animate-pulse rounded"></div>
                    <div className="h-4 bg-muted animate-pulse rounded w-5/6"></div>
                    <div className="h-4 bg-muted animate-pulse rounded w-4/6"></div>
                  </div>
                ) : htmlBodyContent ? (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md"
                    dangerouslySetInnerHTML={{ __html: htmlBodyContent }}
                    data-testid="email-html-content"
                    style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word'
                    }}
                  />
                ) : textBodyContent ? (
                  <pre 
                    className="text-sm whitespace-pre-wrap font-sans text-foreground"
                    data-testid="email-text-content"
                    style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word'
                    }}
                  >
                    {textBodyContent}
                  </pre>
                ) : selectedMessage.bodyText ? (
                  <pre 
                    className="text-sm whitespace-pre-wrap font-sans text-foreground"
                    data-testid="email-text-content-fallback"
                    style={{
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word'
                    }}
                  >
                    {selectedMessage.bodyText}
                  </pre>
                ) : (
                  <p className="text-muted-foreground italic text-center py-8">Sin contenido</p>
                )}

                {/* Attachments - Siempre visible si hay adjuntos */}
                {emailContent?.attachments && emailContent.attachments.length > 0 && (
                  <div className="pt-4 border-t">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Archivos Adjuntos ({emailContent.attachments.filter((a: any) => !a.isInline).length > 0 ? emailContent.attachments.filter((a: any) => !a.isInline).length : emailContent.attachments.length})
                    </h3>
                    <div className="space-y-2">
                      {emailContent.attachments.map((attachment: any, index: number) => {
                        // Siempre mostrar adjuntos que no son inline, y también los inline si no hay otros
                        const shouldShow = !attachment.isInline || emailContent.attachments.filter((a: any) => !a.isInline).length === 0;
                        if (!shouldShow) return null;
                        
                        const Icon = getFileIcon(attachment.mimeType);
                        const isImage = attachment.mimeType.startsWith('image/');
                        const isPdf = attachment.mimeType === 'application/pdf';
                        
                        return (
                          <div 
                            key={attachment.id || index} 
                            className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-md transition-all group" 
                            data-testid={`card-attachment-${attachment.id}`}
                          >
                            {/* Thumbnail más grande para imágenes */}
                            {isImage && attachment.signedUrl ? (
                              <div className="w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0 cursor-pointer" onClick={() => window.open(attachment.signedUrl, '_blank')}>
                                <img
                                  src={attachment.signedUrl}
                                  alt={attachment.filename}
                                  className="w-full h-full object-cover hover:scale-110 transition-transform"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <div className="w-16 h-16 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Icon className="w-7 h-7 text-primary" />
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate mb-1" title={attachment.filename}>
                                {attachment.filename}
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(attachment.size)}
                                </p>
                                {attachment.isInline && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                    Inline
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex gap-1 flex-shrink-0">
                              {(isImage || isPdf) && attachment.signedUrl && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 p-0"
                                  onClick={() => window.open(attachment.signedUrl, '_blank')}
                                  data-testid={`button-preview-${attachment.id}`}
                                  title="Vista previa"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 w-9 p-0"
                                onClick={() => {
                                  window.open(`/api/gmail/attachments/${attachment.id}/download`, '_blank');
                                }}
                                data-testid={`button-download-${attachment.id}`}
                                title="Descargar"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilesTab({ operationId }: { operationId: string }) {
  const { toast } = useToast();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const { data: folders = [], isLoading: loadingFolders } = useQuery<any[]>({
    queryKey: ["/api/operations", operationId, "folders"],
  });

  const { data: files = [], isLoading: loadingFiles } = useQuery<any[]>({
    queryKey: ["/api/operations", operationId, "files", selectedFolder],
    queryFn: async () => {
      const response = await fetch(`/api/operations/${operationId}/files?folderId=${selectedFolder || 'null'}`);
      if (!response.ok) throw new Error("Error al cargar archivos");
      return response.json();
    },
  });

  const handleUploadComplete = async (fileURL: string, file: any) => {
    try {
      await apiRequest(`/api/operations/${operationId}/files`, "POST", {
        name: file.name,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        objectPath: fileURL,
        folderId: selectedFolder,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      toast({ title: "Archivo subido exitosamente" });
    } catch (error) {
      toast({ title: "Error al guardar archivo", variant: "destructive" });
    }
  };

  const createFolderMutation = useMutation({
    mutationFn: async (folderName: string) => {
      return apiRequest(`/api/operations/${operationId}/folders`, "POST", {
        name: folderName,
        parentFolderId: selectedFolder,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "folders"] });
      toast({ title: "Folder created successfully" });
      setIsCreateFolderOpen(false);
      setNewFolderName("");
    },
    onError: (error: any) => {
      console.error("Folder creation error:", error);
      toast({ title: "Error creating folder", description: error?.message || "Unknown error", variant: "destructive" });
    },
  });

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName.trim());
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType.includes("pdf")) return "📄";
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
    return "📎";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  if (loadingFolders || loadingFiles) {
    return <div className="text-center py-8 text-muted-foreground">Cargando archivos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Archivos de la Operación</h3>
          <p className="text-sm text-muted-foreground">
            {files.length} archivo{files.length !== 1 ? 's' : ''}
            {selectedFolder && folders.find((f: any) => f.id === selectedFolder) && (
              <> en {folders.find((f: any) => f.id === selectedFolder)?.name}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsCreateFolderOpen(true)} variant="outline" data-testid="button-create-folder">
            <FolderOpen className="w-4 h-4 mr-2" />
            Nueva Carpeta
          </Button>
          <Button onClick={() => setIsUploadOpen(true)} data-testid="button-upload-file">
            <Upload className="w-4 h-4 mr-2" />
            Subir Archivo
          </Button>
        </div>
      </div>

      {folders.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedFolder === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedFolder(null)}
            data-testid="button-folder-root"
          >
            📁 Todos los archivos
          </Button>
          {folders.map((folder: any) => (
            <Button
              key={folder.id}
              variant={selectedFolder === folder.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFolder(folder.id)}
              data-testid={`button-folder-${folder.id}`}
            >
              📁 {folder.name}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {files.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No hay archivos en esta carpeta
          </div>
        ) : (
          files.map((file: any) => (
            <Card key={file.id} className="hover-elevate" data-testid={`card-file-${file.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="text-2xl flex-shrink-0">
                      {getFileIcon(file.mimeType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" data-testid={`text-filename-${file.id}`}>
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                      {file.category && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          {file.category}
                        </Badge>
                      )}
                      {file.uploadedVia === 'automation' && (
                        <Badge variant="outline" className="text-xs mt-1 ml-1">
                          Auto
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(file.objectPath, '_blank')}
                    data-testid={`button-download-${file.id}`}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
                {file.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {file.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ObjectUploader
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={handleUploadComplete}
      />

      <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g: Payments, Invoices, Photos..."
                data-testid="input-folder-name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateFolderOpen(false);
                  setNewFolderName("");
                }}
                data-testid="button-cancel-folder"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || createFolderMutation.isPending}
                data-testid="button-confirm-folder"
              >
                {createFolderMutation.isPending ? "Creating..." : "Create Folder"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
