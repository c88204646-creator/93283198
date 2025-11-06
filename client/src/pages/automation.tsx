import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Zap, Settings, Activity, Trash2, Mail, Filter, CheckCircle, XCircle, AlertCircle, Package, FileText, Receipt, Users } from "lucide-react";
import type { AutomationConfig, AutomationRule, AutomationLog, GmailAccount, Employee } from "@shared/schema";

// Módulos de automatización disponibles
const AVAILABLE_MODULES = [
  {
    id: "operation-email-automation",
    name: "Automatización de Operaciones desde Email",
    description: "Crea operaciones automáticamente cuando llegan correos con patrones específicos (ej: NAVI-123)",
    icon: Package,
    category: "operations",
  },
  {
    id: "invoice-email-automation",
    name: "Automatización de Facturas desde Email",
    description: "Genera facturas automáticamente desde correos con información de facturación",
    icon: FileText,
    category: "invoices",
    comingSoon: true,
  },
  {
    id: "expense-receipt-automation",
    name: "Automatización de Gastos desde Recibos",
    description: "Registra gastos automáticamente cuando llegan correos con recibos adjuntos",
    icon: Receipt,
    category: "expenses",
    comingSoon: true,
  },
];

export default function AutomationPage() {
  const { toast } = useToast();
  const [selectedModule, setSelectedModule] = useState<typeof AVAILABLE_MODULES[0] | null>(null);

  const { data: configs = [], isLoading: configsLoading } = useQuery<AutomationConfig[]>({
    queryKey: ["/api/automation/configs"],
  });

  const { data: gmailAccounts = [] } = useQuery<GmailAccount[]>({
    queryKey: ["/api/gmail/accounts"],
  });

  // Obtener configuración activa para cada módulo
  const getModuleConfig = (moduleId: string) => {
    return configs.find((c) => c.moduleName === moduleId);
  };

  if (configsLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="loading-automation">
        <div className="text-muted-foreground">Cargando automatizaciones...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-automation-title">Módulos de Automatización</h1>
        <p className="text-muted-foreground">
          Activa y configura módulos para automatizar procesos desde correos electrónicos
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {AVAILABLE_MODULES.map((module) => {
          const config = getModuleConfig(module.id);
          const ModuleIcon = module.icon;
          const isActive = config?.isEnabled || false;

          return (
            <Card 
              key={module.id} 
              className={`relative ${module.comingSoon ? 'opacity-60' : ''}`}
              data-testid={`card-module-${module.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ModuleIcon className="w-6 h-6 text-primary" />
                  </div>
                  {module.comingSoon ? (
                    <Badge variant="secondary">Próximamente</Badge>
                  ) : (
                    <Badge variant={isActive ? "default" : "outline"} data-testid={`badge-status-${module.id}`}>
                      {isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-lg">{module.name}</CardTitle>
                <CardDescription className="text-sm">{module.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {!module.comingSoon && (
                  <Button
                    className="w-full"
                    variant={isActive ? "default" : "outline"}
                    onClick={() => setSelectedModule(module)}
                    data-testid={`button-configure-${module.id}`}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    {config ? "Configurar" : "Activar"}
                  </Button>
                )}
                {module.comingSoon && (
                  <Button className="w-full" variant="secondary" disabled>
                    Próximamente
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedModule && (
        <ModuleConfigurationDialog
          module={selectedModule}
          config={getModuleConfig(selectedModule.id)}
          gmailAccounts={gmailAccounts}
          onClose={() => setSelectedModule(null)}
        />
      )}
    </div>
  );
}

function ModuleConfigurationDialog({ 
  module, 
  config,
  gmailAccounts,
  onClose 
}: { 
  module: typeof AVAILABLE_MODULES[0];
  config?: AutomationConfig;
  gmailAccounts: GmailAccount[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"settings" | "rules" | "logs">("settings");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    (config?.selectedGmailAccounts as string[]) || []
  );
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>(
    (config?.defaultEmployees as string[]) || []
  );
  const [processAttachments, setProcessAttachments] = useState<boolean>(
    config?.processAttachments ?? false
  );
  const [autoCreateTasks, setAutoCreateTasks] = useState<string>(
    config?.autoCreateTasks || 'disabled'
  );
  const [autoCreateNotes, setAutoCreateNotes] = useState<string>(
    config?.autoCreateNotes || 'disabled'
  );
  const [aiOptimizationLevel, setAiOptimizationLevel] = useState<string>(
    config?.aiOptimizationLevel || 'high'
  );
  const [customFolderNames, setCustomFolderNames] = useState<Record<string, string>>(
    (config?.customFolderNames as Record<string, string>) || {}
  );

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const createConfigMutation = useMutation({
    mutationFn: async (sanitizedNames: Record<string, string>) => {
      return apiRequest("POST", "/api/automation/configs", {
        moduleName: module.id,
        moduleDescription: module.description,
        isEnabled: true,
        selectedGmailAccounts: selectedAccounts,
        defaultEmployees: selectedEmployees,
        processAttachments: processAttachments,
        autoCreateTasks,
        autoCreateNotes,
        aiOptimizationLevel,
        customFolderNames: sanitizedNames,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/configs"] });
      toast({
        title: "Módulo activado",
        description: "El módulo ha sido activado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo activar el módulo",
        variant: "destructive",
      });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ isEnabled, accounts, employees, attachments, tasks, notes, optimization, folderNames }: { isEnabled?: boolean; accounts?: string[]; employees?: string[]; attachments?: boolean; tasks?: string; notes?: string; optimization?: string; folderNames?: Record<string, string> }) => {
      return apiRequest("PATCH", `/api/automation/configs/${config!.id}`, {
        isEnabled,
        selectedGmailAccounts: accounts,
        defaultEmployees: employees,
        processAttachments: attachments,
        autoCreateTasks: tasks,
        autoCreateNotes: notes,
        aiOptimizationLevel: optimization,
        customFolderNames: folderNames,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/configs"] });
      toast({
        title: "Configuración actualizada",
        description: "Los cambios han sido guardados correctamente.",
      });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/automation/configs/${config!.id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/configs"] });
      toast({
        title: "Módulo desactivado",
        description: "El módulo ha sido desactivado completamente.",
      });
      onClose();
    },
  });

  const handleToggle = (enabled: boolean) => {
    if (config) {
      updateConfigMutation.mutate({ isEnabled: enabled });
    }
  };

  const handleSaveSettings = () => {
    // Sanitize customFolderNames: trim and remove empty values
    const sanitizedFolderNames = Object.fromEntries(
      Object.entries(customFolderNames)
        .map(([key, value]) => [key, value.trim()])
        .filter(([_, value]) => value)
    );
    
    if (config) {
      updateConfigMutation.mutate({ accounts: selectedAccounts, employees: selectedEmployees, attachments: processAttachments, tasks: autoCreateTasks, notes: autoCreateNotes, optimization: aiOptimizationLevel, folderNames: sanitizedFolderNames });
    } else {
      createConfigMutation.mutate(sanitizedFolderNames);
    }
  };

  const ModuleIcon = module.icon;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ModuleIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle>{module.name}</DialogTitle>
              <DialogDescription>{module.description}</DialogDescription>
            </div>
            {config && (
              <Switch
                checked={config.isEnabled}
                onCheckedChange={handleToggle}
                data-testid="switch-module-enable"
              />
            )}
          </div>
        </DialogHeader>

        <div className="flex gap-2 border-b">
          <Button
            variant={activeTab === "settings" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("settings")}
            data-testid="button-tab-settings"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configuración
          </Button>
          {config && (
            <>
              <Button
                variant={activeTab === "rules" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("rules")}
                data-testid="button-tab-rules"
              >
                <Filter className="w-4 h-4 mr-2" />
                Reglas
              </Button>
              <Button
                variant={activeTab === "logs" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("logs")}
                data-testid="button-tab-logs"
              >
                <Activity className="w-4 h-4 mr-2" />
                Logs
              </Button>
            </>
          )}
        </div>

        <div className="py-4">
          {activeTab === "settings" && (
            <SettingsTab
              config={config}
              gmailAccounts={gmailAccounts}
              employees={employees}
              selectedAccounts={selectedAccounts}
              selectedEmployees={selectedEmployees}
              processAttachments={processAttachments}
              autoCreateTasks={autoCreateTasks}
              autoCreateNotes={autoCreateNotes}
              aiOptimizationLevel={aiOptimizationLevel}
              onAccountsChange={setSelectedAccounts}
              onEmployeesChange={setSelectedEmployees}
              onProcessAttachmentsChange={setProcessAttachments}
              onAutoCreateTasksChange={setAutoCreateTasks}
              onAutoCreateNotesChange={setAutoCreateNotes}
              onAiOptimizationLevelChange={setAiOptimizationLevel}
              customFolderNames={customFolderNames}
              onCustomFolderNamesChange={setCustomFolderNames}
              onSave={handleSaveSettings}
              onDelete={() => {
                if (confirm("¿Desactivar este módulo completamente?")) {
                  deleteConfigMutation.mutate();
                }
              }}
              isSaving={createConfigMutation.isPending || updateConfigMutation.isPending}
              isDeleting={deleteConfigMutation.isPending}
            />
          )}
          {activeTab === "rules" && config && (
            <RulesTab configId={config.id} />
          )}
          {activeTab === "logs" && config && (
            <LogsTab configId={config.id} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsTab({
  config,
  gmailAccounts,
  employees,
  selectedAccounts,
  selectedEmployees,
  processAttachments,
  autoCreateTasks,
  autoCreateNotes,
  aiOptimizationLevel,
  customFolderNames,
  onAccountsChange,
  onEmployeesChange,
  onProcessAttachmentsChange,
  onAutoCreateTasksChange,
  onAutoCreateNotesChange,
  onAiOptimizationLevelChange,
  onCustomFolderNamesChange,
  onSave,
  onDelete,
  isSaving,
  isDeleting,
}: {
  config?: AutomationConfig;
  gmailAccounts: GmailAccount[];
  employees: Employee[];
  selectedAccounts: string[];
  selectedEmployees: string[];
  processAttachments: boolean;
  autoCreateTasks: string;
  autoCreateNotes: string;
  aiOptimizationLevel: string;
  customFolderNames: Record<string, string>;
  onAccountsChange: (accounts: string[]) => void;
  onEmployeesChange: (employees: string[]) => void;
  onProcessAttachmentsChange: (enabled: boolean) => void;
  onAutoCreateTasksChange: (mode: string) => void;
  onAutoCreateNotesChange: (mode: string) => void;
  onAiOptimizationLevelChange: (level: string) => void;
  onCustomFolderNamesChange: (names: Record<string, string>) => void;
  onSave: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold mb-3 block">Cuentas Gmail a Monitorear</Label>
        <p className="text-sm text-muted-foreground mb-4">
          Selecciona las cuentas de Gmail desde las cuales este módulo procesará correos
        </p>
        {gmailAccounts.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="py-6 text-center">
              <Mail className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No hay cuentas Gmail conectadas. Ve a la sección Gmail para conectar una cuenta.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 border rounded-lg p-4">
            {gmailAccounts.map((account) => (
              <div key={account.id} className="flex items-center gap-3 p-2 hover:bg-accent rounded-md">
                <input
                  type="checkbox"
                  id={`account-${account.id}`}
                  checked={selectedAccounts.includes(account.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onAccountsChange([...selectedAccounts, account.id]);
                    } else {
                      onAccountsChange(selectedAccounts.filter((id) => id !== account.id));
                    }
                  }}
                  className="rounded border-input"
                  data-testid={`checkbox-account-${account.id}`}
                />
                <Label htmlFor={`account-${account.id}`} className="text-sm cursor-pointer flex-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {account.email}
                  </div>
                </Label>
                {account.syncEnabled && (
                  <Badge variant="secondary" className="text-xs">Sincronizando</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="text-base font-semibold mb-3 block">Empleados Asignados por Defecto</Label>
        <p className="text-sm text-muted-foreground mb-4">
          Selecciona los empleados que se asignarán automáticamente a las operaciones creadas
        </p>
        {employees.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="py-6 text-center">
              <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No hay empleados disponibles. Crea empleados en la sección de Empleados.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 border rounded-lg p-4">
            {employees.map((employee) => (
              <div key={employee.id} className="flex items-center gap-3 p-2 hover:bg-accent rounded-md">
                <input
                  type="checkbox"
                  id={`employee-${employee.id}`}
                  checked={selectedEmployees.includes(employee.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onEmployeesChange([...selectedEmployees, employee.id]);
                    } else {
                      onEmployeesChange(selectedEmployees.filter((id) => id !== employee.id));
                    }
                  }}
                  className="rounded border-input"
                  data-testid={`checkbox-employee-${employee.id}`}
                />
                <Label htmlFor={`employee-${employee.id}`} className="text-sm cursor-pointer flex-1">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    {employee.name}
                  </div>
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Label className="text-base font-semibold">Procesar Adjuntos de Email</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Cuando está activado, los archivos adjuntos de los correos serán descargados automáticamente
              y organizados en carpetas por categoría (Pagos, Gastos, Fotos, Facturas, Contratos, Documentos)
            </p>
          </div>
          <Switch
            checked={processAttachments}
            onCheckedChange={onProcessAttachmentsChange}
            data-testid="switch-process-attachments"
          />
        </div>

        {processAttachments && (
          <div className="pt-4 border-t">
            <Label className="text-base font-semibold mb-3 block">📁 Nombres Personalizados de Carpetas</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Configura nombres personalizados para las carpetas donde se organizarán los archivos adjuntos automáticamente
            </p>
            
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { key: "payments", defaultName: "Payments", icon: "💰" },
                { key: "expenses", defaultName: "Expenses", icon: "💸" },
                { key: "images", defaultName: "Images", icon: "🖼️" },
                { key: "invoices", defaultName: "Invoices", icon: "🧾" },
                { key: "contracts", defaultName: "Contracts", icon: "📋" },
                { key: "documents", defaultName: "Documents", icon: "📄" },
              ].map((category) => (
                <div key={category.key}>
                  <Label htmlFor={`folder-${category.key}`} className="text-sm font-medium mb-1 block">
                    {category.icon} {category.defaultName}
                  </Label>
                  <Input
                    id={`folder-${category.key}`}
                    value={customFolderNames[category.key] || ""}
                    onChange={(e) => {
                      const newNames = { ...customFolderNames };
                      if (e.target.value) {
                        newNames[category.key] = e.target.value;
                      } else {
                        delete newNames[category.key];
                      }
                      onCustomFolderNamesChange(newNames);
                    }}
                    placeholder={category.defaultName}
                    data-testid={`input-folder-${category.key}`}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              💡 Deja en blanco para usar los nombres predeterminados
            </p>
          </div>
        )}

        <div className="pt-4 border-t">
          <Label className="text-base font-semibold mb-3 block">🤖 Automatización con Gemini AI</Label>
          <p className="text-sm text-muted-foreground mb-4">
            Utiliza inteligencia artificial para analizar cadenas de correos y crear automáticamente tareas y notas relevantes
          </p>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium mb-2 block">Crear Tareas Automáticamente</Label>
              <Select value={autoCreateTasks} onValueChange={onAutoCreateTasksChange}>
                <SelectTrigger data-testid="select-auto-tasks">
                  <SelectValue placeholder="Seleccionar modo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">🚫 Desactivado</SelectItem>
                  <SelectItem value="basic">✅ Básico (sin AI)</SelectItem>
                  <SelectItem value="smart_ai">🤖 Inteligente con AI</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {autoCreateTasks === 'smart_ai' && '✨ Usa Gemini AI para detectar tareas pendientes en correos'}
                {autoCreateTasks === 'basic' && '📋 Extrae tareas de palabras clave simples'}
                {autoCreateTasks === 'disabled' && 'No se crearán tareas automáticamente'}
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Crear Notas Automáticamente</Label>
              <Select value={autoCreateNotes} onValueChange={onAutoCreateNotesChange}>
                <SelectTrigger data-testid="select-auto-notes">
                  <SelectValue placeholder="Seleccionar modo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">🚫 Desactivado</SelectItem>
                  <SelectItem value="basic">✅ Básico (sin AI)</SelectItem>
                  <SelectItem value="smart_ai">🤖 Inteligente con AI</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {autoCreateNotes === 'smart_ai' && '✨ Usa Gemini AI para extraer información importante'}
                {autoCreateNotes === 'basic' && '📝 Crea resúmenes simples de correos'}
                {autoCreateNotes === 'disabled' && 'No se crearán notas automáticamente'}
              </p>
            </div>
          </div>

          {(autoCreateTasks === 'smart_ai' || autoCreateNotes === 'smart_ai') && (
            <div className="mt-4 p-3 bg-primary/5 rounded-lg">
              <Label className="text-sm font-medium mb-2 block">Nivel de Optimización de API</Label>
              <Select value={aiOptimizationLevel} onValueChange={onAiOptimizationLevelChange}>
                <SelectTrigger data-testid="select-ai-optimization">
                  <SelectValue placeholder="Seleccionar nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">🔋 Alto (80% reducción de uso)</SelectItem>
                  <SelectItem value="medium">⚡ Medio (50% reducción de uso)</SelectItem>
                  <SelectItem value="low">💨 Bajo (20% reducción de uso)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                💡 <strong>Recomendado: Alto</strong> - Reduce significativamente el consumo de API mediante caché inteligente,
                deduplicación y análisis diferencial sin afectar la calidad
              </p>
            </div>
          )}
        </div>
      </div>

      {config && config.lastProcessedAt && (
        <div className="text-sm text-muted-foreground">
          Última ejecución: {new Date(config.lastProcessedAt).toLocaleString("es-MX")}
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t">
        <Button
          onClick={onSave}
          disabled={selectedAccounts.length === 0 || isSaving}
          data-testid="button-save-settings"
        >
          {isSaving ? "Guardando..." : config ? "Guardar Cambios" : "Activar Módulo"}
        </Button>
        {config && (
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={isDeleting}
            data-testid="button-delete-config"
          >
            {isDeleting ? "Eliminando..." : "Desactivar Módulo"}
          </Button>
        )}
      </div>
    </div>
  );
}

function RulesTab({ configId }: { configId: string }) {
  const { toast } = useToast();
  const [showNewRuleDialog, setShowNewRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  const { data: rules = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ["/api/automation/configs", configId, "rules"],
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest("DELETE", `/api/automation/rules/${ruleId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/configs", configId, "rules"] });
      toast({
        title: "Regla eliminada",
        description: "La regla ha sido eliminada correctamente.",
      });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      return apiRequest("PATCH", `/api/automation/rules/${id}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/configs", configId, "rules"] });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando reglas...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Reglas de Automatización</h3>
          <p className="text-sm text-muted-foreground">Define qué correos debe procesar este módulo</p>
        </div>
        <Button size="sm" onClick={() => setShowNewRuleDialog(true)} data-testid="button-create-rule">
          <Filter className="w-4 h-4 mr-2" />
          Nueva Regla
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card className="text-center py-8">
          <CardContent>
            <Filter className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No hay reglas configuradas</p>
            <p className="text-xs text-muted-foreground mt-1">
              Crea reglas para definir qué correos deben procesarse
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} data-testid={`card-rule-${rule.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-base">{(rule as any).name}</CardTitle>
                      <Badge variant={rule.isEnabled ? "default" : "secondary"} data-testid={`badge-rule-status-${rule.id}`}>
                        {rule.isEnabled ? "Activa" : "Inactiva"}
                      </Badge>
                      {rule.priority !== undefined && rule.priority > 0 && (
                        <Badge variant="outline">Prioridad: {rule.priority}</Badge>
                      )}
                    </div>
                    {rule.description && (
                      <CardDescription className="text-sm">{rule.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.isEnabled}
                      onCheckedChange={(checked) =>
                        toggleRuleMutation.mutate({ id: rule.id, isEnabled: checked })
                      }
                      data-testid={`switch-rule-${rule.id}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingRule(rule)}
                      data-testid={`button-edit-rule-${rule.id}`}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("¿Eliminar esta regla?")) {
                          deleteRuleMutation.mutate(rule.id);
                        }
                      }}
                      data-testid={`button-delete-rule-${rule.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="font-medium">Condiciones:</span>
                    <div className="mt-1 space-y-1">
                      {((rule.conditions as any) || []).map((cond: any, idx: number) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          • {cond.field} {cond.operator} "{cond.value}"
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Acciones:</span>
                    <div className="mt-1 space-y-1">
                      {((rule.actions as any) || []).map((action: any, idx: number) => (
                        <div key={idx} className="text-xs text-muted-foreground">
                          • {action.type === "create_operation" ? "Crear operación" : action.type}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showNewRuleDialog && (
        <RuleFormDialog
          configId={configId}
          onClose={() => setShowNewRuleDialog(false)}
        />
      )}

      {editingRule && (
        <RuleFormDialog
          configId={configId}
          rule={editingRule}
          onClose={() => setEditingRule(null)}
        />
      )}
    </div>
  );
}

function RuleFormDialog({ 
  configId, 
  rule, 
  onClose 
}: { 
  configId: string; 
  rule?: AutomationRule;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [ruleName, setRuleName] = useState((rule as any)?.name || "");
  const [description, setDescription] = useState(rule?.description || "");
  const [priority, setPriority] = useState(rule?.priority?.toString() || "0");
  const [pattern, setPattern] = useState(() => {
    const conditions = (rule?.conditions as any) || [];
    const subjectCondition = conditions.find((c: any) => c.field === "subject");
    return subjectCondition?.value || "NAVI-";
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name: ruleName,
        description,
        priority: parseInt(priority) || 0,
        isEnabled: true,
        conditions: [
          { field: "subject", operator: "contains", value: pattern }
        ],
        actions: [
          { 
            type: "create_operation",
            params: {
              idPattern: pattern,
              defaultCategory: "import",
              defaultType: "FCL",
              defaultMode: "sea",
              defaultInsurance: "no",
              defaultCurrency: "USD",
            }
          }
        ],
      };

      if (rule) {
        return apiRequest("PATCH", `/api/automation/rules/${rule.id}`, data);
      } else {
        return apiRequest("POST", `/api/automation/configs/${configId}/rules`, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/configs", configId, "rules"] });
      toast({
        title: rule ? "Regla actualizada" : "Regla creada",
        description: "La regla ha sido guardada correctamente.",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la regla",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? "Editar Regla" : "Nueva Regla"}</DialogTitle>
          <DialogDescription>
            Configura las condiciones para procesar correos automáticamente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="ruleName">Nombre de la Regla</Label>
            <Input
              id="ruleName"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="Ej: Detectar NAVI"
              data-testid="input-rule-name"
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe qué hace esta regla"
              rows={2}
              data-testid="input-rule-description"
            />
          </div>

          <div>
            <Label htmlFor="priority">Prioridad</Label>
            <Input
              id="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              placeholder="0"
              data-testid="input-rule-priority"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Mayor número = mayor prioridad
            </p>
          </div>

          <div>
            <Label htmlFor="pattern">Patrón en el Asunto</Label>
            <Input
              id="pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="NAVI-"
              data-testid="input-rule-pattern"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ej: "NAVI-" buscará correos con "NAVI-123" en el asunto
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-rule">
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!ruleName || !pattern || saveMutation.isPending}
            data-testid="button-save-rule"
          >
            {saveMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogsTab({ configId }: { configId: string }) {
  const { data: logs = [], isLoading } = useQuery<AutomationLog[]>({
    queryKey: ["/api/automation/configs", configId, "logs"],
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando logs...</div>;
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Historial de Ejecuciones</h3>
      
      {logs.length === 0 ? (
        <Card className="text-center py-8">
          <CardContent>
            <Activity className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No hay logs registrados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <Card key={log.id} data-testid={`card-log-${log.id}`}>
              <CardContent className="py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {log.status === "success" && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {log.status === "error" && <XCircle className="w-4 h-4 text-destructive" />}
                    {log.status === "skipped" && <AlertCircle className="w-4 h-4 text-yellow-500" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{log.actionType}</span>
                      <Badge variant={log.status === "success" ? "default" : log.status === "error" ? "destructive" : "secondary"}>
                        {log.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {new Date(log.createdAt).toLocaleString("es-MX")}
                      </span>
                    </div>
                    {log.errorMessage && (
                      <p className="text-xs text-destructive">{log.errorMessage}</p>
                    )}
                    {log.details && (
                      <p className="text-xs text-muted-foreground">
                        {JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
