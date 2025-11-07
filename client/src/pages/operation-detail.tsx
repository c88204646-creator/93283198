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
import { es } from "date-fns/locale";
import {
  ArrowLeft, Package, FileText, CheckSquare, Mail, Edit2, Trash2, Plus,
  Calendar, User as UserIcon, MapPin, Ship, Plane, Truck, DollarSign, FolderOpen,
  Download, Paperclip, Upload, Link, FileIcon, Image, ExternalLink, Eye, MoreVertical,
  Grid3x3, List, Zap, File, ChevronLeft, ChevronRight, FileArchive, FileSpreadsheet, Clock, X,
  Phone, Building2
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import DOMPurify from 'isomorphic-dompurify';
import type { Operation, OperationNote, OperationTask, Employee, User, Client, GmailMessage, Payment, InsertPayment, Invoice, Expense, InsertExpense, BankAccount } from "@shared/schema";
import { insertPaymentSchema, insertExpenseSchema } from "@shared/schema";
import { FileUploader } from "@/components/FileUploader";
import { OperationAnalysisComponent } from "@/components/OperationAnalysis";
import { TaskKanban } from "@/components/TaskKanban";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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

        {/* Header profesional mejorado con iconos SVG logísticos */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-white via-blue-50/30 to-indigo-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/30 border border-slate-200 dark:border-slate-700 shadow-xl">
          {/* Patrón de fondo con iconos logísticos */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="logistics-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                  <path d="M10,30 L20,30 L20,40 L30,40 L30,30 L40,30 L40,50 L10,50 Z M45,35 L55,35 L50,45 Z M15,60 L25,60 L20,70 Z" 
                        fill="currentColor" opacity="0.15"/>
                  <circle cx="70" cy="35" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
                  <path d="M65,60 Q70,55 75,60 Q80,65 85,60" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.15"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#logistics-pattern)"/>
            </svg>
          </div>
          
          {/* Barra de acento superior con gradiente animado */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 via-purple-500 to-blue-500 bg-[length:200%_100%] animate-[gradient_8s_ease-in-out_infinite]" />
          
          {/* Elementos decorativos flotantes */}
          <div className="absolute top-4 right-8 opacity-10 dark:opacity-5">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 30 L35 30 L35 45 L50 45 L50 30 L65 30 L65 60 L20 60 Z" fill="currentColor" opacity="0.4"/>
              <circle cx="27" cy="57" r="3" fill="currentColor"/>
              <circle cx="58" cy="57" r="3" fill="currentColor"/>
              <path d="M40 20 L50 35 L30 35 Z" fill="currentColor" opacity="0.6"/>
            </svg>
          </div>

          <div className="relative p-5 md:p-6">
            <div className="flex flex-col md:flex-row items-start gap-4">
              {/* Botón de retorno mejorado */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate('/operations')}
                data-testid="button-back"
                className="shrink-0 h-9 w-9 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md hover:bg-white dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600 shadow-sm hover:shadow-md transition-all group"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              </Button>

              {/* Contenido principal */}
              <div className="flex-1 space-y-3 w-full min-w-0">
                {/* Fila superior: Icono, Título y badges - Compacto */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    {/* Icono logístico según tipo de operación */}
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 p-2 shadow-md flex items-center justify-center">
                      {operation.operationType?.toLowerCase() === 'air' ? (
                        <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M3 18L9 12L3 6L4 5L13 11V3L14 2L16 4L18 6L16 7L14 9V17L4 19L3 18Z" fill="currentColor"/>
                          <path d="M18 14L21 11L20 10L17 13L18 14Z" fill="currentColor" opacity="0.7"/>
                        </svg>
                      ) : operation.operationType?.toLowerCase() === 'fcl' || operation.operationType?.toLowerCase() === 'lcl' || operation.operationType?.toLowerCase() === 'sea' ? (
                        <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 6H20L19 11H5L4 6Z" fill="currentColor"/>
                          <path d="M5 11H19L18 16H6L5 11Z" fill="currentColor" opacity="0.8"/>
                          <path d="M6 16H18V18H6V16Z" fill="currentColor" opacity="0.6"/>
                          <circle cx="8" cy="18" r="1.5" fill="currentColor"/>
                          <circle cx="16" cy="18" r="1.5" fill="currentColor"/>
                        </svg>
                      ) : (
                        <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 8H14L16 6H20V16H4V8Z" fill="currentColor"/>
                          <path d="M6 10H12V14H6V10Z" fill="currentColor" opacity="0.5"/>
                          <circle cx="7" cy="16" r="1.5" fill="currentColor"/>
                          <circle cx="17" cy="16" r="1.5" fill="currentColor"/>
                        </svg>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 truncate" data-testid="text-operation-name">
                          {operation.name}
                        </h1>
                      </div>
                      {client && (
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                            <UserIcon className="w-3 h-3" />
                            <span className="font-medium">{client.name}</span>
                          </div>
                          {operation.bookingTracking && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2 4H14L13 8H3L2 4Z M3 8H13L12 12H4L3 8Z" fill="currentColor" opacity="0.7"/>
                              </svg>
                              <span className="font-mono text-[10px]">{operation.bookingTracking}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Badges organizados con iconos */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg border border-blue-500/20 shadow-sm">
                      {getOperationTypeIcon(operation.operationType)}
                      <span className="text-xs font-bold uppercase tracking-wide">{operation.operationType}</span>
                    </div>
                    <Badge className={`${getStatusColor(operation.status)} text-xs px-3 py-1.5 shadow-sm border-0 font-semibold`} data-testid="badge-status">
                      <span className="mr-1.5">●</span>
                      {operation.status === 'planning' ? 'Planificación' : 
                       operation.status === 'in-progress' ? 'En Progreso' : 
                       operation.status === 'completed' ? 'Completado' : 
                       'Cancelado'}
                    </Badge>
                    {operation.priority && (
                      <Badge className={`${getPriorityColor(operation.priority)} text-xs px-3 py-1.5 shadow-sm border-0 font-semibold`} data-testid="badge-priority">
                        {operation.priority === 'urgent' && <span className="mr-1">⚡</span>}
                        {operation.priority === 'low' ? 'Baja' : 
                         operation.priority === 'medium' ? 'Media' : 
                         operation.priority === 'high' ? 'Alta' : 
                         'Urgente'}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Descripción con mejor diseño */}
                {operation.description && (
                  <div className="relative pl-15">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500/50 to-transparent rounded-full" />
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed pl-3" data-testid="text-description">
                      {operation.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Botón de edición compacto */}
              <Button
                onClick={() => navigate(`/operations/edit/${id}`)}
                data-testid="button-edit"
                size="sm"
                className="shrink-0 h-8 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all group"
              >
                <Edit2 className="w-3 h-3 mr-1.5 transition-transform group-hover:rotate-12" />
                <span className="text-xs font-medium">Editar</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs mejorados */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-9 h-auto p-1 bg-muted/50 backdrop-blur-sm rounded-xl">
            <TabsTrigger 
              value="info" 
              data-testid="tab-info"
              className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all py-3"
            >
              <Package className="w-4 h-4 mr-2" />
              <span className="font-medium">Información</span>
            </TabsTrigger>
            <TabsTrigger 
              value="client" 
              data-testid="tab-client"
              className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all py-3"
            >
              <UserIcon className="w-4 h-4 mr-2" />
              <span className="font-medium">Cliente</span>
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
              value="payments" 
              data-testid="tab-payments"
              className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all py-3"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              <span className="font-medium">Pagos</span>
            </TabsTrigger>
            <TabsTrigger 
              value="invoices" 
              data-testid="tab-invoices"
              className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all py-3"
            >
              <FileText className="w-4 h-4 mr-2" />
              <span className="font-medium">Facturas</span>
            </TabsTrigger>
            <TabsTrigger 
              value="expenses" 
              data-testid="tab-expenses"
              className="data-[state=active]:bg-background data-[state=active]:shadow-md rounded-lg transition-all py-3"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              <span className="font-medium">Gastos</span>
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

          <TabsContent value="client" className="space-y-4 mt-6 animate-in fade-in-50 duration-300">
            <ClientTab operation={operation} client={client} />
          </TabsContent>

          <TabsContent value="notes" className="space-y-4 mt-6 animate-in fade-in-50 duration-300">
            <NotesTab operationId={id!} notes={notes} users={users} />
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4 mt-6 animate-in fade-in-50 duration-300">
            <TasksTab operationId={id!} tasks={tasks} employees={employees} users={users} />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4 mt-6 animate-in fade-in-50 duration-300">
            <PaymentsTab operationId={id!} />
          </TabsContent>

          <TabsContent value="invoices" className="space-y-4 mt-6 animate-in fade-in-50 duration-300">
            <InvoicesTab operationId={id!} />
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4 mt-6 animate-in fade-in-50 duration-300">
            <ExpensesTab operationId={id!} />
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
    <div className="space-y-6">
      {/* AI-Powered Operation Analysis */}
      <OperationAnalysisComponent operationId={operation.id} />

      {/* Existing Information Cards */}
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
                {operation.pickUpDate ? format(new Date(operation.pickUpDate), 'PPP', { locale: es }) : 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors">
            <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">ETD (Fecha Estimada de Salida)</Label>
              <p className="font-semibold text-base mt-1" data-testid="text-etd">
                {operation.etd ? format(new Date(operation.etd), 'PPP', { locale: es }) : 'N/A'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">ETA (Fecha Estimada de Llegada)</Label>
              <p className="font-semibold text-base mt-1" data-testid="text-eta">
                {operation.eta ? format(new Date(operation.eta), 'PPP', { locale: es }) : 'N/A'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
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
      return apiRequest('POST', `/api/operations/${operationId}/notes`, { content });
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
      return apiRequest('PATCH', `/api/operations/${operationId}/notes/${noteId}`, { content });
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
      return apiRequest('DELETE', `/api/operations/${operationId}/notes/${noteId}`);
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

  const handleDeleteNote = (noteId: string) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
      deleteNoteMutation.mutate(noteId);
    }
  };

  // Agrupar notas por fecha
  const groupedNotes = useMemo(() => {
    const groups: { [key: string]: OperationNote[] } = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    notes.forEach((note) => {
      const noteDate = new Date(note.createdAt);
      let groupKey: string;

      if (noteDate.toDateString() === today.toDateString()) {
        groupKey = 'Hoy';
      } else if (noteDate.toDateString() === yesterday.toDateString()) {
        groupKey = 'Ayer';
      } else {
        groupKey = format(noteDate, 'dd MMMM yyyy', { locale: es });
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(note);
    });

    return groups;
  }, [notes]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Formulario de nueva nota a la izquierda */}
      <div className="lg:col-span-1">
        <Card className="border-primary/20 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="w-4 h-4 text-primary" />
              Nueva Nota
            </CardTitle>
            <CardDescription className="text-xs">Agrega una nota o comentario importante</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="relative">
                <Textarea
                  placeholder="Escribe tu nota aquí..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={6}
                  data-testid="input-new-note"
                  className="resize-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                />
                <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
                  {newNote.length} caracteres
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  La nota se guardará con la fecha y hora actual
                </p>
                <Button
                  onClick={handleCreateNote}
                  disabled={createNoteMutation.isPending || !newNote.trim()}
                  data-testid="button-create-note"
                  className="w-full h-9"
                  size="sm"
                >
                  {createNoteMutation.isPending ? (
                    <>
                      <Clock className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 mr-2" />
                      Agregar Nota
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline de notas a la derecha con scroll */}
      <div className="lg:col-span-2">
        <Card className="border-primary/20 shadow-md">
          <CardHeader className="bg-muted/30 border-b pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-primary" />
              Timeline de Notas
            </CardTitle>
            <CardDescription className="text-xs">{notes.length} nota{notes.length !== 1 ? 's' : ''} registrada{notes.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-24rem)]">
              <div className="p-4 space-y-4">
                {notes.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-20 h-20 rounded-full bg-muted/30 mx-auto mb-4 flex items-center justify-center">
                      <FileText className="w-10 h-10 text-muted-foreground opacity-40" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No hay notas todavía</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Comienza agregando la primera nota para documentar el progreso y detalles importantes de esta operación
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {Object.entries(groupedNotes).map(([dateGroup, groupNotes]) => (
                      <div key={dateGroup} className="space-y-3">
                        {/* Encabezado de fecha - Compacto */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1 rounded-full">
                            <Calendar className="w-3 h-3 text-primary" />
                            <span className="text-xs font-semibold text-primary">{dateGroup}</span>
                          </div>
                          <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent"></div>
                        </div>

                        {/* Timeline de notas del grupo - Compacto */}
                        <div className="relative pl-6 space-y-3">
                          {/* Línea vertical del timeline */}
                          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/40 via-primary/20 to-transparent"></div>

                          {groupNotes.map((note, index) => {
                            const user = users.find(u => u.id === note.userId);
                            const isEditing = editingNote === note.id;
                            const isAutomated = note.createdAutomatically;

                            return (
                              <div key={note.id} className="relative group" data-testid={`card-note-${note.id}`}>
                                {/* Punto del timeline - Más pequeño */}
                                <div className={`absolute -left-[22px] top-1.5 w-3 h-3 rounded-full border-2 ${
                                  isAutomated 
                                    ? 'bg-blue-500 border-blue-300 shadow-md shadow-blue-500/50' 
                                    : 'bg-primary border-primary/30 shadow-md shadow-primary/30'
                                }`}>
                                  {isAutomated && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <Zap className="w-2 h-2 text-white" />
                                    </div>
                                  )}
                                </div>

                                <Card className={`transition-all hover:shadow-sm ${
                                  isAutomated 
                                    ? 'border-blue-200 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20 dark:border-blue-800' 
                                    : 'border-border hover:border-primary/30'
                                }`}>
                                  <CardHeader className="pb-2 pt-3 px-3">
                                    <div className="flex items-start justify-between gap-3">
                                      {/* Info del usuario y hora - Compacto */}
                                      <div className="flex items-center gap-2 flex-1">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                          isAutomated 
                                            ? 'bg-blue-500 text-white' 
                                            : 'bg-primary/10 text-primary'
                                        }`}>
                                          {isAutomated ? (
                                            <Zap className="w-3.5 h-3.5" />
                                          ) : (
                                            (user?.username || 'U').charAt(0).toUpperCase()
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="font-semibold text-xs truncate" data-testid={`text-note-user-${note.id}`}>
                                              {isAutomated ? 'Sistema Automático' : (user?.username || 'Usuario')}
                                            </span>
                                            {isAutomated && (
                                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300">
                                                <Zap className="w-2.5 h-2.5 mr-0.5" />
                                                Auto
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                            <Clock className="w-2.5 h-2.5" />
                                            {format(new Date(note.createdAt), "HH:mm 'hrs'", { locale: es })}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Botones de acción - Compactos */}
                                      {!isEditing && !isAutomated && (
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              startEdit(note);
                                            }}
                                            data-testid={`button-edit-note-${note.id}`}
                                            className="h-6 w-6 p-0"
                                          >
                                            <Edit2 className="w-3 h-3" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteNote(note.id);
                                            }}
                                            data-testid={`button-delete-note-${note.id}`}
                                            className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  </CardHeader>
                                  <CardContent className="px-3 pb-3">
                                    {isEditing ? (
                                      <div className="space-y-2">
                                        <Textarea
                                          value={editContent}
                                          onChange={(e) => setEditContent(e.target.value)}
                                          rows={3}
                                          data-testid={`input-edit-note-${note.id}`}
                                          className="resize-none text-xs"
                                        />
                                        <div className="flex gap-1.5">
                                          <Button
                                            size="sm"
                                            onClick={() => handleUpdateNote(note.id)}
                                            disabled={updateNoteMutation.isPending}
                                            data-testid={`button-save-note-${note.id}`}
                                            className="h-7 text-xs"
                                          >
                                            {updateNoteMutation.isPending ? 'Guardando...' : 'Guardar'}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={cancelEdit}
                                            data-testid={`button-cancel-note-${note.id}`}
                                            className="h-7 text-xs"
                                          >
                                            Cancelar
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        <p className="whitespace-pre-wrap leading-relaxed text-xs" data-testid={`text-note-content-${note.id}`}>
                                          {note.content}
                                        </p>
                                        {isAutomated && note.aiConfidence && (
                                          <div className="flex items-center gap-1.5 pt-1.5 border-t text-[10px] text-muted-foreground">
                                            <span>Confianza IA:</span>
                                            <div className="flex-1 max-w-[150px] h-1.5 bg-muted rounded-full overflow-hidden">
                                              <div 
                                                className="h-full bg-blue-500 transition-all" 
                                                style={{ width: `${note.aiConfidence}%` }}
                                              ></div>
                                            </div>
                                            <span className="font-medium">{parseFloat(note.aiConfidence).toFixed(0)}%</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
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
  const [editingTask, setEditingTask] = useState<OperationTask | null>(null);
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
      return apiRequest('POST', `/api/operations/${operationId}/tasks`, taskData);
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
      return apiRequest('PATCH', `/api/operations/${operationId}/tasks/${taskId}`, {
        ...updates,
        modifiedManually: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/operations/${operationId}/tasks`] });
      setEditingTask(null);
      toast({ title: "Tarea actualizada exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al actualizar la tarea", variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest('DELETE', `/api/operations/${operationId}/tasks/${taskId}`);
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

  const handleEditTask = (task: OperationTask) => {
    setEditingTask(task);
  };

  const handleSaveEdit = () => {
    if (!editingTask) return;
    updateTaskMutation.mutate({
      taskId: editingTask.id,
      updates: {
        title: editingTask.title,
        description: editingTask.description,
        status: editingTask.status,
        priority: editingTask.priority,
        assignedToId: editingTask.assignedToId,
        dueDate: editingTask.dueDate,
        completedAt: editingTask.status === 'completed' ? new Date().toISOString() : null,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Task Creation Dialog */}
      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nueva Tarea</DialogTitle>
            <DialogDescription>Crea una nueva tarea para esta operación</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                    <SelectItem value="pending-approval">Por Aprobar</SelectItem>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTask(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending}>
              Crear Tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Edit Dialog */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Tarea</DialogTitle>
            <DialogDescription>Modifica los detalles de la tarea</DialogDescription>
          </DialogHeader>
          {editingTask && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    placeholder="Título de la tarea"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Asignado a</Label>
                  <Select
                    value={editingTask.assignedToId || "unassigned"}
                    onValueChange={(value) => setEditingTask({ ...editingTask, assignedToId: value === "unassigned" ? null : value })}
                  >
                    <SelectTrigger>
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
                    value={editingTask.status}
                    onValueChange={(value) => setEditingTask({ ...editingTask, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="in-progress">En Progreso</SelectItem>
                      <SelectItem value="pending-approval">Por Aprobar</SelectItem>
                      <SelectItem value="completed">Completada</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prioridad</Label>
                  <Select
                    value={editingTask.priority}
                    onValueChange={(value) => setEditingTask({ ...editingTask, priority: value })}
                  >
                    <SelectTrigger>
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
                    value={editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  placeholder="Descripción de la tarea"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateTaskMutation.isPending}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kanban Board */}
      <TaskKanban
        operationId={operationId}
        tasks={tasks}
        employees={employees}
        users={users}
        onAddTask={() => setShowNewTask(true)}
        onEditTask={handleEditTask}
        onDeleteTask={(taskId) => {
          if (confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
            deleteTaskMutation.mutate(taskId);
          }
        }}
      />
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
                        <div className="flex items-start gap-1.5 min-w-0 w-full">
                          <div className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-[10px] font-medium ${
                            isSelected 
                              ? 'bg-primary/20 text-primary' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {email.fromEmail?.[0]?.toUpperCase() || 'U'}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <p className={`text-[10px] font-medium truncate max-w-[140px] ${isSelected ? 'opacity-95' : 'text-foreground'}`}>
                                {email.fromEmail.split('@')[0]}
                              </p>
                              <time className={`text-[8px] shrink-0 ${isSelected ? 'opacity-70' : 'text-muted-foreground'}`}>
                                {format(new Date(email.date), 'HH:mm')}
                              </time>
                            </div>

                            <p className={`text-[10px] font-medium truncate mb-0.5 ${isSelected ? 'opacity-95' : 'text-foreground'}`}>
                              {email.subject || '(Sin asunto)'}
                            </p>

                            <div className="flex items-center gap-1">
                              <p className={`text-[9px] line-clamp-1 flex-1 min-w-0 ${isSelected ? 'opacity-75' : 'text-muted-foreground'}`}>
                                {email.snippet}
                              </p>
                              {email.hasAttachments && (
                                <Paperclip className={`w-2.5 h-2.5 shrink-0 ${isSelected ? 'opacity-70' : 'text-muted-foreground'}`} />
                              )}
                            </div>
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
  const [selectedFolder, setSelectedFolder] = useState<string | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFile, setEditingFile] = useState<any>(null);
  const [editFileName, setEditFileName] = useState("");
  const [editFileFolderId, setEditFileFolderId] = useState<string | null>(null);
  const [deletingFile, setDeletingFile] = useState<any>(null);
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [deletingFolder, setDeletingFolder] = useState<any>(null);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const { data: folders = [], isLoading: loadingFolders } = useQuery<any[]>({
    queryKey: ["/api/operations", operationId, "folders"],
  });

  const { data: allFiles = [], isLoading: loadingFiles } = useQuery<any[]>({
    queryKey: ["/api/operations", operationId, "files", selectedFolder],
    queryFn: async () => {
      const response = await fetch(
        selectedFolder === "all"
          ? `/api/operations/${operationId}/files`
          : `/api/operations/${operationId}/files?folderId=${selectedFolder === null ? 'null' : selectedFolder}`
      );
      if (!response.ok) throw new Error("Error al cargar archivos");
      const data = await response.json();

      // Fetch preview URLs for images and PDFs
      const previewableFileIds = data
        .filter((f: any) => f.mimeType.startsWith("image/") || f.mimeType.includes("pdf"))
        .map((f: any) => f.id);

      if (previewableFileIds.length > 0) {
        try {
          const urlResponse = await fetch(`/api/operations/${operationId}/files/preview-urls`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileIds: previewableFileIds }),
          });
          if (urlResponse.ok) {
            const urls = await urlResponse.json();
            setPreviewUrls(urls);
          }
        } catch (error) {
          console.error("Failed to fetch preview URLs:", error);
        }
      }

      return data;
    },
  });

  const files = allFiles;

  const handleUploadComplete = async (result: { b2Key: string; fileHash: string; size: number; originalName: string; mimeType: string }) => {
    try {
      await apiRequest("POST", `/api/operations/${operationId}/files`, {
        originalName: result.originalName,
        b2Key: result.b2Key,
        fileHash: result.fileHash,
        mimeType: result.mimeType,
        size: result.size,
        folderId: selectedFolder === "all" ? null : selectedFolder,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      setIsUploadOpen(false);
      toast({ title: "File uploaded successfully" });
    } catch (error: any) {
      console.error("File save error:", error);
      toast({ title: "Error saving file", description: error?.message || "Unknown error", variant: "destructive" });
    }
  };

  const createFolderMutation = useMutation({
    mutationFn: async (folderName: string) => {
      return apiRequest("POST", `/api/operations/${operationId}/folders`, {
        name: folderName,
        parentFolderId: selectedFolder === "all" ? null : selectedFolder,
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

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      return apiRequest("DELETE", `/api/operations/${operationId}/folders/${folderId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      toast({ title: "Folder deleted successfully" });
      setDeletingFolder(null);
      setSelectedFolder(null);
    },
    onError: (error: any) => {
      toast({ title: "Error deleting folder", description: error?.message, variant: "destructive" });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({ folderId, name }: { folderId: string; name: string }) => {
      return apiRequest("PATCH", `/api/operations/${operationId}/folders/${folderId}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "folders"] });
      toast({ title: "Folder updated successfully" });
      setEditingFolder(null);
      setEditFolderName("");
    },
    onError: (error: any) => {
      toast({ title: "Error updating folder", description: error?.message, variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return apiRequest("DELETE", `/api/operations/${operationId}/files/${fileId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      toast({ title: "File deleted successfully" });
      setDeletingFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Error deleting file", description: error?.message, variant: "destructive" });
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async ({ fileId, name, folderId }: { fileId: string; name: string; folderId: string | null }) => {
      return apiRequest("PATCH", `/api/operations/${operationId}/files/${fileId}`, { name, folderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      toast({ title: "File updated successfully" });
      setEditingFile(null);
      setEditFileName("");
      setEditFileFolderId(null);
    },
    onError: (error: any) => {
      toast({ title: "Error updating file", description: error?.message, variant: "destructive" });
    },
  });

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return Image;
    if (mimeType.includes("pdf")) return FileText;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
    if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("compressed")) return FileArchive;
    return File;
  };

  const getFileTypeLabel = (mimeType: string): string => {
    if (mimeType.includes("pdf")) return "PDF";
    if (mimeType.includes("image")) return "Image";
    if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "Spreadsheet";
    if (mimeType.includes("word") || mimeType.includes("document")) return "Document";
    if (mimeType.includes("zip") || mimeType.includes("rar")) return "Archive";
    return "File";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handlePreview = (file: any) => {
    if (file.mimeType.startsWith("image/") || file.mimeType.includes("pdf")) {
      const previewableFiles = files.filter((f: any) => 
        f.mimeType.startsWith("image/") || f.mimeType.includes("pdf")
      );
      const index = previewableFiles.findIndex((f: any) => f.id === file.id);
      setPreviewIndex(index);
      setPreviewFile(file);
    }
  };

  const nextPreview = () => {
    const previewableFiles = files.filter((f: any) => 
      f.mimeType.startsWith("image/") || f.mimeType.includes("pdf")
    );
    if (previewIndex < previewableFiles.length - 1) {
      const nextFile = previewableFiles[previewIndex + 1];
      setPreviewFile(nextFile);
      setPreviewIndex(previewIndex + 1);
    }
  };

  const prevPreview = () => {
    const previewableFiles = files.filter((f: any) => 
      f.mimeType.startsWith("image/") || f.mimeType.includes("pdf")
    );
    if (previewIndex > 0) {
      const prevFile = previewableFiles[previewIndex - 1];
      setPreviewFile(prevFile);
      setPreviewIndex(previewIndex - 1);
    }
  };

  if (loadingFolders || loadingFiles) {
    return <div className="text-center py-8 text-muted-foreground">Cargando archivos...</div>;
  }

  const previewableFiles = files.filter((f: any) => 
    f.mimeType.startsWith("image/") || f.mimeType.includes("pdf")
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Archivos de la Operación</h3>
          <p className="text-sm text-muted-foreground">
            {files.length} archivo{files.length !== 1 ? 's' : ''}
            {selectedFolder !== "all" && folders.find((f: any) => f.id === selectedFolder) && (
              <> en {folders.find((f: any) => f.id === selectedFolder)?.name}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            data-testid="button-toggle-view"
          >
            {viewMode === "grid" ? <List className="w-4 h-4" /> : <Grid3x3 className="w-4 h-4" />}
          </Button>
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

      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={selectedFolder === "all" ? "default" : "outline"}
          onClick={() => setSelectedFolder("all")}
          className="shrink-0"
          data-testid="button-folder-root"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          Todos los archivos
        </Button>
        {folders.length > 0 && (
          <>
          {folders.map((folder: any) => (
            <div key={folder.id} className="relative shrink-0 group">
              <Button
                variant={selectedFolder === folder.id ? "default" : "outline"}
                onClick={() => setSelectedFolder(folder.id)}
                data-testid={`button-folder-${folder.id}`}
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                {folder.name}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-1 -right-1 w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-folder-menu-${folder.id}`}
                  >
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingFolder(folder);
                      setEditFolderName(folder.name);
                    }}
                    data-testid={`button-edit-folder-${folder.id}`}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Folder
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeletingFolder(folder)}
                    className="text-red-600"
                    data-testid={`button-delete-folder-${folder.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Folder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          </>
        )}
      </div>

      {files.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
          <h3 className="text-lg font-semibold mb-2">No hay archivos</h3>
          <p className="text-muted-foreground mb-4">
            Sube tu primer archivo para comenzar
          </p>
          <Button onClick={() => setIsUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Subir Archivo
          </Button>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {files.map((file: any) => {
            const FileIconComponent = getFileIcon(file.mimeType);
            const isImage = file.mimeType.startsWith("image/");
            const isPDF = file.mimeType.includes("pdf");
            const isAutomated = file.uploadedVia === "gmail_automation" || !!file.sourceGmailAttachmentId;
            const thumbnailUrl = previewUrls[file.id];

            return (
              <Card
                key={file.id}
                className="group overflow-hidden hover:shadow-md transition-all cursor-pointer"
                onClick={() => handlePreview(file)}
                data-testid={`card-file-${file.id}`}
              >
                {/* Thumbnail/Preview */}
                <div className="relative h-32 bg-gradient-to-br from-muted/30 to-muted/50 flex items-center justify-center overflow-hidden">
                  {isImage && thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt={file.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <FileIconComponent className="w-12 h-12 text-muted-foreground/30" />
                  )}

                  {/* Automated Badge - Small circular icon */}
                  {isAutomated && (
                    <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow-md" title="Automated file">
                      <Zap className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}

                  {/* Actions Menu */}
                  <div className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="secondary" size="icon" className="w-7 h-7 shadow-md" data-testid={`button-file-menu-${file.id}`}>
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/api/operations/${operationId}/files/${file.id}/download`, "_blank");
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFile(file);
                            setEditFileName(file.name);
                            setEditFileFolderId(file.folderId);
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingFile(file);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* File Info */}
                <div className="p-3">
                  <h3 className="font-medium text-sm truncate mb-1" title={file.name}>
                    {file.name}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatFileSize(file.size)}</span>
                    <span className="text-[10px]">{getFileTypeLabel(file.mimeType)}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="divide-y">
            {files.map((file: any) => {
              const FileIconComponent = getFileIcon(file.mimeType);
              const isImage = file.mimeType.startsWith("image/");
              const isAutomated = file.uploadedVia === "gmail_automation" || !!file.sourceGmailAttachmentId;
              const thumbnailUrl = previewUrls[file.id];

              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => handlePreview(file)}
                  data-testid={`card-file-${file.id}`}
                >
                  {/* Icon/Thumbnail */}
                  <div className="relative w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {isImage && thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileIconComponent className="w-5 h-5 text-muted-foreground" />
                    )}
                    {isAutomated && (
                      <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center" title="Automated file">
                        <Zap className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{file.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{formatFileSize(file.size)}</span>
                      <span>{getFileTypeLabel(file.mimeType)}</span>
                      <span>{format(new Date(file.createdAt), "MMM d, yyyy")}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/api/operations/${operationId}/files/${file.id}/download`, "_blank");
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFile(file);
                            setEditFileName(file.name);
                            setEditFileFolderId(file.folderId);
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingFile(file);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Upload File to Operation</DialogTitle>
            <DialogDescription>
              {selectedFolder 
                ? `Upload a file to the "${folders.find((f: any) => f.id === selectedFolder)?.name}" folder`
                : "Upload a file to the root directory"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <FileUploader
              operationId={operationId!}
              onUploadComplete={handleUploadComplete}
            />
          </div>
          <DialogFooter className="sm:justify-start">
            <p className="text-xs text-muted-foreground">
              Files are securely stored in Backblaze B2 with automatic deduplication
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={!!editingFolder} onOpenChange={(open) => !open && setEditingFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-folder-name">Folder Name</Label>
              <Input
                id="edit-folder-name"
                value={editFolderName}
                onChange={(e) => setEditFolderName(e.target.value)}
                placeholder="Folder name"
                data-testid="input-edit-folder-name"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingFolder(null)}
                data-testid="button-cancel-edit-folder"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingFolder && editFolderName.trim()) {
                    updateFolderMutation.mutate({
                      folderId: editingFolder.id,
                      name: editFolderName.trim(),
                    });
                  }
                }}
                disabled={!editFolderName.trim() || updateFolderMutation.isPending}
                data-testid="button-save-folder"
              >
                {updateFolderMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingFolder} onOpenChange={(open) => !open && setDeletingFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingFolder?.name}"? All files in this folder will also be deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingFolder(null)}
              data-testid="button-cancel-delete-folder"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingFolder && deleteFolderMutation.mutate(deletingFolder.id)}
              disabled={deleteFolderMutation.isPending}
              data-testid="button-confirm-delete-folder"
            >
              {deleteFolderMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingFile} onOpenChange={(open) => !open && setEditingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-file-name">File Name</Label>
              <Input
                id="edit-file-name"
                value={editFileName}
                onChange={(e) => setEditFileName(e.target.value)}
                placeholder="File name"
                data-testid="input-edit-file-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-file-folder">Folder</Label>
              <Select
                value={editFileFolderId || "root"}
                onValueChange={(value) => setEditFileFolderId(value === "root" ? null : value)}
              >
                <SelectTrigger data-testid="select-edit-file-folder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Root (No Folder)</SelectItem>
                  {folders.map((folder: any) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditingFile(null)}
                data-testid="button-cancel-edit-file"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingFile && editFileName.trim()) {
                    updateFileMutation.mutate({
                      fileId: editingFile.id,
                      name: editFileName.trim(),
                      folderId: editFileFolderId,
                    });
                  }
                }}
                disabled={!editFileName.trim() || updateFileMutation.isPending}
                data-testid="button-save-file"
              >
                {updateFileMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingFile} onOpenChange={(open) => !open && setDeletingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingFile?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingFile(null)}
              data-testid="button-cancel-delete-file"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingFile && deleteFileMutation.mutate(deletingFile.id)}
              disabled={deleteFileMutation.isPending}
              data-testid="button-confirm-delete-file"
            >
              {deleteFileMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="truncate text-base">{previewFile?.name}</DialogTitle>
              <div className="flex items-center gap-1.5 shrink-0">
                {previewableFiles.length > 1 && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={prevPreview}
                      disabled={previewIndex === 0}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground px-1.5">
                      {previewIndex + 1} / {previewableFiles.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={nextPreview}
                      disabled={previewIndex === previewableFiles.length - 1}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.open(`/api/operations/${operationId}/files/${previewFile?.id}/download`, "_blank")}
                >
                  <Download className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPreviewFile(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden rounded-lg bg-muted/20 flex items-center justify-center">
            {previewFile?.mimeType.startsWith("image/") ? (
              <img
                src={previewUrls[previewFile.id] || `/api/operations/${operationId}/files/${previewFile.id}/download`}
                alt={previewFile.name}
                className="max-w-full max-h-full object-contain"
              />
            ) : previewFile?.mimeType.includes("pdf") ? (
              <iframe
                src={previewUrls[previewFile.id] || `/api/operations/${operationId}/files/${previewFile.id}/download`}
                className="w-full h-full"
                title={previewFile.name}
              />
            ) : (
              <div className="text-center p-8">
                <Eye className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">Preview not available</p>
                <Button
                  className="mt-3"
                  size="sm"
                  onClick={() => window.open(`/api/operations/${operationId}/files/${previewFile?.id}/download`, "_blank")}
                >
                  <Download className="w-3.5 h-3.5 mr-2" />
                  Download to View
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Client Tab - Muestra información del cliente (readonly, reutiliza UI del módulo de clientes)
function ClientTab({ operation, client }: { operation: Operation; client?: Client }) {
  const [, navigate] = useLocation();

  if (!client) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-muted/30 mx-auto mb-4 flex items-center justify-center">
            <UserIcon className="w-10 h-10 text-muted-foreground opacity-40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No hay cliente asignado</h3>
          <p className="text-muted-foreground mb-6">
            Edita la operación para asignar un cliente a esta operación
          </p>
          <Button onClick={() => navigate(`/operations/edit/${operation.id}`)} variant="outline">
            <Edit2 className="w-4 h-4 mr-2" />
            Asignar Cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
        return {
          label: 'Activo',
          className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          icon: '●'
        };
      case 'inactive':
        return {
          label: 'Inactivo',
          className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
          icon: '○'
        };
      case 'potential':
        return {
          label: 'Potencial',
          className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          icon: '◐'
        };
      default:
        return {
          label: status,
          className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
          icon: '●'
        };
    }
  };

  const statusConfig = getStatusConfig(client.status);

  return (
    <div className="space-y-6">
      {/* Header Card con información principal */}
      <Card className="overflow-hidden border-primary/20 shadow-lg">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-1" data-testid="text-client-name">
                  {client.name}
                </h2>
                <div className="flex items-center gap-2">
                  <Badge className={statusConfig.className} data-testid="badge-client-status">
                    <span className="mr-1">{statusConfig.icon}</span>
                    {statusConfig.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Cliente desde {format(new Date(client.createdAt), "MMM yyyy")}
                  </span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => navigate(`/clients/${client.id}`)}
              variant="outline"
              size="sm"
              data-testid="button-view-client"
            >
              <Eye className="w-4 h-4 mr-2" />
              Ver Perfil
            </Button>
          </div>
        </div>
      </Card>

      {/* Información de contacto y detalles */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <CardHeader className="bg-muted/30 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="w-4 h-4 text-primary" />
              Información de Contacto
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Email</Label>
                <a 
                  href={`mailto:${client.email}`} 
                  className="font-medium text-primary hover:underline block truncate mt-1"
                  data-testid="link-client-email"
                >
                  {client.email}
                </a>
              </div>
            </div>

            {client.phone && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <Phone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Teléfono</Label>
                  <a 
                    href={`tel:${client.phone}`} 
                    className="font-medium text-primary hover:underline block truncate mt-1"
                    data-testid="link-client-phone"
                  >
                    {client.phone}
                  </a>
                </div>
              </div>
            )}

            {!client.phone && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Phone className="w-5 h-5 text-muted-foreground/50 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Teléfono</Label>
                  <p className="text-sm text-muted-foreground italic mt-1">No registrado</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <CardHeader className="bg-muted/30 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="w-4 h-4 text-primary" />
              Detalles del Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <DollarSign className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Moneda</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="font-semibold" data-testid="badge-client-currency">
                    {client.currency}
                  </Badge>
                  <span className="text-xs text-muted-foreground italic">
                    (No editable)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <Calendar className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cliente desde</Label>
                <p className="font-medium mt-1" data-testid="text-client-created-at">
                  {format(new Date(client.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dirección */}
      {client.address && (
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <CardHeader className="bg-muted/30 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="w-4 h-4 text-primary" />
              Dirección
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
              <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="font-medium leading-relaxed" data-testid="text-client-address">
                {client.address}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notas */}
      {client.notes && (
        <Card className="overflow-hidden hover:shadow-md transition-shadow">
          <CardHeader className="bg-muted/30 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-primary" />
              Notas del Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-sm whitespace-pre-wrap leading-relaxed" data-testid="text-client-notes">
                {client.notes}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer con acciones */}
      <Card className="bg-muted/20 border-dashed">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Edit2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">¿Necesitas editar este cliente?</h3>
                <p className="text-sm text-muted-foreground">
                  Visita el módulo de Clientes para actualizar la información, agregar notas o cambiar el estado
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/clients')}
              variant="outline"
              data-testid="button-go-to-clients"
            >
              Ir a Clientes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Payments Tab - Gestión de pagos
function PaymentsTab({ operationId }: { operationId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const { toast } = useToast();

  // Fetch payments
  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['/api/operations', operationId, 'payments'],
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: InsertPayment) => {
      if (editingPayment) {
        return apiRequest('PATCH', `/api/payments/${editingPayment.id}`, data);
      } else {
        return apiRequest('POST', `/api/operations/${operationId}/payments`, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations', operationId, 'payments'] });
      setIsDialogOpen(false);
      setEditingPayment(null);
      toast({
        title: editingPayment ? "Pago actualizado" : "Pago creado",
        description: `El pago ha sido ${editingPayment ? 'actualizado' : 'creado'} exitosamente`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el pago",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations', operationId, 'payments'] });
      toast({
        title: "Pago eliminado",
        description: "El pago ha sido eliminado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el pago",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setIsDialogOpen(true);
  };

  const handleDelete = (payment: Payment) => {
    if (confirm(`¿Estás seguro de eliminar el pago de $${payment.amount}?`)) {
      deleteMutation.mutate(payment.id);
    }
  };

  const handleNewPayment = () => {
    setEditingPayment(null);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Cargando pagos...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Pagos de la Operación</h3>
          <p className="text-sm text-muted-foreground">Gestiona los pagos vinculados a esta operación</p>
        </div>
        <Button onClick={handleNewPayment} data-testid="button-new-payment">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Pago
        </Button>
      </div>

      {payments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <DollarSign className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground mb-4">No hay pagos registrados</p>
            <Button onClick={handleNewPayment} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Primer Pago
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                    <TableCell>
                      {format(new Date(payment.paymentDate), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${parseFloat(payment.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{payment.paymentMethod}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {payment.reference || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {payment.notes || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(payment)}
                          data-testid={`button-edit-payment-${payment.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(payment)}
                          data-testid={`button-delete-payment-${payment.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <PaymentFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        payment={editingPayment}
        onSave={(data) => saveMutation.mutate(data)}
        isPending={saveMutation.isPending}
      />
    </div>
  );
}

// Payment Form Dialog Component
function PaymentFormDialog({
  open,
  onOpenChange,
  payment,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment | null;
  onSave: (data: InsertPayment) => void;
  isPending: boolean;
}) {
  // Fetch invoices for dropdown
  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
  });

  // Fetch bank accounts for dropdown
  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['/api/bank-accounts'],
  });

  const form = useForm<InsertPayment>({
    resolver: zodResolver(insertPaymentSchema),
    defaultValues: payment ? {
      invoiceId: payment.invoiceId || undefined,
      operationId: payment.operationId || undefined,
      bankAccountId: payment.bankAccountId || undefined,
      currency: payment.currency || 'MXN',
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      paymentMethod: payment.paymentMethod,
      reference: payment.reference || undefined,
      notes: payment.notes || undefined,
    } : {
      currency: 'MXN',
      amount: "0.00",
      paymentDate: new Date(),
      paymentMethod: "transfer",
    },
  });

  // Watch bankAccountId to validate currency
  const selectedBankAccountId = form.watch('bankAccountId');
  const selectedBankAccount = bankAccounts.find(acc => acc.id === selectedBankAccountId);

  useEffect(() => {
    if (payment) {
      form.reset({
        invoiceId: payment.invoiceId || undefined,
        operationId: payment.operationId || undefined,
        bankAccountId: payment.bankAccountId || undefined,
        currency: payment.currency || 'MXN',
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        reference: payment.reference || undefined,
        notes: payment.notes || undefined,
      });
    } else {
      form.reset({
        currency: 'MXN',
        amount: "0.00",
        paymentDate: new Date(),
        paymentMethod: "transfer",
      });
    }
  }, [payment, form]);

  const handleSubmit = (data: InsertPayment) => {
    // Validate currency matches bank account
    if (selectedBankAccount && data.currency !== selectedBankAccount.currency) {
      form.setError('currency', {
        message: `La divisa del pago debe coincidir con la de la cuenta bancaria (${selectedBankAccount.currency})`,
      });
      return;
    }
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{payment ? 'Editar Pago' : 'Nuevo Pago'}</DialogTitle>
          <DialogDescription>
            {payment ? 'Modifica los detalles del pago' : 'Agrega un nuevo pago a la operación'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="invoiceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Factura *</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      {...field}
                      value={field.value || ''}
                      data-testid="select-invoice"
                    >
                      <option value="">Seleccionar factura...</option>
                      {invoices.map((invoice) => (
                        <option key={invoice.id} value={invoice.id}>
                          {invoice.invoiceNumber} - ${parseFloat(invoice.totalAmount).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bankAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta Bancaria *</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      {...field}
                      value={field.value || ''}
                      data-testid="select-bank-account"
                    >
                      <option value="">Seleccionar cuenta...</option>
                      {bankAccounts.filter(acc => acc.isActive).map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.currency}) - ${parseFloat(account.currentBalance).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                  {selectedBankAccount && (
                    <p className="text-xs text-muted-foreground">
                      Divisa de la cuenta: {selectedBankAccount.currency}
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Divisa *</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      {...field}
                      data-testid="select-currency"
                    >
                      <option value="MXN">MXN - Peso Mexicano</option>
                      <option value="USD">USD - Dólar Estadounidense</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="CAD">CAD - Dólar Canadiense</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                  {selectedBankAccount && field.value !== selectedBankAccount.currency && (
                    <p className="text-xs text-destructive">
                      ⚠️ La divisa no coincide con la de la cuenta bancaria
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      data-testid="input-payment-amount"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha de Pago</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                      data-testid="input-payment-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método de Pago</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      {...field}
                      data-testid="select-payment-method"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                      <option value="check">Cheque</option>
                      <option value="card">Tarjeta</option>
                      <option value="other">Otro</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Número de referencia"
                      {...field}
                      value={field.value || ''}
                      data-testid="input-payment-reference"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas adicionales"
                      {...field}
                      value={field.value || ''}
                      data-testid="input-payment-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-payment">
                {isPending ? 'Guardando...' : payment ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Invoices Tab - Gestión de facturas
function InvoicesTab({ operationId }: { operationId: string }) {
  const [, navigate] = useLocation();

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/operations', operationId, 'invoices'],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Cargando facturas...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Borrador';
      case 'sent': return 'Enviada';
      case 'paid': return 'Pagada';
      case 'overdue': return 'Vencida';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Facturas de la Operación</h3>
          <p className="text-sm text-muted-foreground">Facturas asociadas a esta operación</p>
        </div>
        <Button onClick={() => navigate('/invoices')} data-testid="button-view-invoices">
          <ExternalLink className="w-4 h-4 mr-2" />
          Ir a Facturas
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground mb-4">No hay facturas vinculadas a esta operación</p>
            <Button onClick={() => navigate('/invoices')} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Crear Factura en el Módulo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Factura</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Subtotal</TableHead>
                  <TableHead>Impuesto</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id} data-testid={`row-invoice-${invoice.id}`}>
                    <TableCell className="font-semibold">{invoice.invoiceNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(invoice.createdAt), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      ${parseFloat(invoice.subtotal).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      ${parseFloat(invoice.tax).toFixed(2)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      ${parseFloat(invoice.total).toFixed(2)} {invoice.currency}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(invoice.status)}>
                        {getStatusLabel(invoice.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(invoice.dueDate), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/invoices`)}
                        data-testid={`button-view-invoice-${invoice.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
        <p>💡 <strong>Nota:</strong> Las facturas se crean y editan desde el módulo de Facturas. Aquí puedes ver las facturas asociadas a esta operación.</p>
      </div>
    </div>
  );
}

// Expenses Tab - Gestión de gastos
function ExpensesTab({ operationId }: { operationId: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const { toast } = useToast();

  // Fetch employees for dropdown
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
  });

  // Fetch expenses
  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['/api/operations', operationId, 'expenses'],
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: InsertExpense) => {
      if (editingExpense) {
        return apiRequest('PATCH', `/api/expenses/${editingExpense.id}`, data);
      } else {
        return apiRequest('POST', `/api/operations/${operationId}/expenses`, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations', operationId, 'expenses'] });
      setIsDialogOpen(false);
      setEditingExpense(null);
      toast({
        title: editingExpense ? "Gasto actualizado" : "Gasto creado",
        description: `El gasto ha sido ${editingExpense ? 'actualizado' : 'creado'} exitosamente`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el gasto",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/operations', operationId, 'expenses'] });
      toast({
        title: "Gasto eliminado",
        description: "El gasto ha sido eliminado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el gasto",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setIsDialogOpen(true);
  };

  const handleDelete = (expense: Expense) => {
    if (confirm(`¿Estás seguro de eliminar el gasto de $${expense.amount}?`)) {
      deleteMutation.mutate(expense.id);
    }
  };

  const handleNewExpense = () => {
    setEditingExpense(null);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Cargando gastos...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'reimbursed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'approved': return 'Aprobado';
      case 'rejected': return 'Rechazado';
      case 'reimbursed': return 'Reembolsado';
      default: return status;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'travel': return 'Viaje';
      case 'supplies': return 'Suministros';
      case 'equipment': return 'Equipo';
      case 'services': return 'Servicios';
      case 'other': return 'Otro';
      default: return category;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Gastos de la Operación</h3>
          <p className="text-sm text-muted-foreground">Gestiona los gastos vinculados a esta operación</p>
        </div>
        <Button onClick={handleNewExpense} data-testid="button-new-expense">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Gasto
        </Button>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <DollarSign className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground mb-4">No hay gastos registrados</p>
            <Button onClick={handleNewExpense} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Primer Gasto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                    <TableCell>
                      {format(new Date(expense.date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(expense.category)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{expense.description}</TableCell>
                    <TableCell className="font-semibold">
                      ${parseFloat(expense.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(expense.status)}>
                        {getStatusLabel(expense.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(expense)}
                          data-testid={`button-edit-expense-${expense.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(expense)}
                          data-testid={`button-delete-expense-${expense.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ExpenseFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        expense={editingExpense}
        employees={employees}
        onSave={(data) => saveMutation.mutate(data)}
        isPending={saveMutation.isPending}
      />
    </div>
  );
}

// Expense Form Dialog Component
function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  employees,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: Expense | null;
  employees: Employee[];
  onSave: (data: InsertExpense) => void;
  isPending: boolean;
}) {
  // Fetch bank accounts for dropdown
  const { data: bankAccounts = [] } = useQuery<BankAccount[]>({
    queryKey: ['/api/bank-accounts'],
  });

  const form = useForm<InsertExpense>({
    resolver: zodResolver(insertExpenseSchema),
    defaultValues: expense ? {
      operationId: expense.operationId || undefined,
      employeeId: expense.employeeId,
      bankAccountId: expense.bankAccountId || undefined,
      currency: expense.currency || 'MXN',
      category: expense.category,
      amount: expense.amount,
      description: expense.description,
      date: expense.date,
      status: expense.status,
      receiptUrl: expense.receiptUrl || undefined,
    } : {
      currency: 'MXN',
      amount: "0.00",
      date: new Date(),
      category: "other",
      status: "pending",
      description: "",
    },
  });

  // Watch bankAccountId to validate currency
  const selectedBankAccountId = form.watch('bankAccountId');
  const selectedBankAccount = bankAccounts.find(acc => acc.id === selectedBankAccountId);

  useEffect(() => {
    if (expense) {
      form.reset({
        operationId: expense.operationId || undefined,
        employeeId: expense.employeeId,
        bankAccountId: expense.bankAccountId || undefined,
        currency: expense.currency || 'MXN',
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        date: expense.date,
        status: expense.status,
        receiptUrl: expense.receiptUrl || undefined,
      });
    } else {
      form.reset({
        currency: 'MXN',
        amount: "0.00",
        date: new Date(),
        category: "other",
        status: "pending",
        description: "",
      });
    }
  }, [expense, form]);

  const handleSubmit = (data: InsertExpense) => {
    // Validate currency matches bank account
    if (selectedBankAccount && data.currency !== selectedBankAccount.currency) {
      form.setError('currency', {
        message: `La divisa del gasto debe coincidir con la de la cuenta bancaria (${selectedBankAccount.currency})`,
      });
      return;
    }
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{expense ? 'Editar Gasto' : 'Nuevo Gasto'}</DialogTitle>
          <DialogDescription>
            {expense ? 'Modifica los detalles del gasto' : 'Agrega un nuevo gasto a la operación'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empleado</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      {...field}
                      data-testid="select-employee"
                    >
                      <option value="">Seleccionar empleado</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bankAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta Bancaria *</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      {...field}
                      value={field.value || ''}
                      data-testid="select-bank-account-expense"
                    >
                      <option value="">Seleccionar cuenta...</option>
                      {bankAccounts.filter(acc => acc.isActive).map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({account.currency}) - ${parseFloat(account.currentBalance).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                  {selectedBankAccount && (
                    <p className="text-xs text-muted-foreground">
                      Divisa de la cuenta: {selectedBankAccount.currency}
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Divisa *</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      {...field}
                      data-testid="select-currency-expense"
                    >
                      <option value="MXN">MXN - Peso Mexicano</option>
                      <option value="USD">USD - Dólar Estadounidense</option>
                      <option value="EUR">EUR - Euro</option>
                      <option value="CAD">CAD - Dólar Canadiense</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                  {selectedBankAccount && field.value !== selectedBankAccount.currency && (
                    <p className="text-xs text-destructive">
                      ⚠️ La divisa no coincide con la de la cuenta bancaria
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      {...field}
                      data-testid="select-category"
                    >
                      <option value="travel">Viaje</option>
                      <option value="supplies">Suministros</option>
                      <option value="equipment">Equipo</option>
                      <option value="services">Servicios</option>
                      <option value="other">Otro</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      data-testid="input-expense-amount"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe el gasto"
                      {...field}
                      data-testid="input-expense-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                      onChange={(e) => field.onChange(new Date(e.target.value))}
                      data-testid="input-expense-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      {...field}
                      data-testid="select-status"
                    >
                      <option value="pending">Pendiente</option>
                      <option value="approved">Aprobado</option>
                      <option value="rejected">Rechazado</option>
                      <option value="reimbursed">Reembolsado</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="receiptUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL del Recibo (Opcional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://..."
                      {...field}
                      value={field.value || ''}
                      data-testid="input-receipt-url"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-expense">
                {isPending ? 'Guardando...' : expense ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}