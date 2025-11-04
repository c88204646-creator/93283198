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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Zap, Plus, Settings, Activity, Trash2, Mail, Filter, CheckCircle, XCircle, AlertCircle, Sparkles } from "lucide-react";
import type { AutomationConfig, AutomationRule, AutomationLog, GmailAccount } from "@shared/schema";

export default function AutomationPage() {
  const { toast } = useToast();
  const [selectedConfig, setSelectedConfig] = useState<AutomationConfig | null>(null);
  const [showNewModuleDialog, setShowNewModuleDialog] = useState(false);

  const { data: configs = [], isLoading: configsLoading } = useQuery<AutomationConfig[]>({
    queryKey: ["/api/automation/configs"],
  });

  const { data: gmailAccounts = [] } = useQuery<GmailAccount[]>({
    queryKey: ["/api/gmail/accounts"],
  });

  const toggleConfigMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      return apiRequest("PATCH", `/api/automation/configs/${id}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/configs"] });
      toast({
        title: "Configuración actualizada",
        description: "El módulo ha sido actualizado correctamente.",
      });
    },
  });

  if (configsLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="loading-automation">
        <div className="text-muted-foreground">Cargando automatizaciones...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-automation-title">Automatizaciones</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona módulos de automatización para crear operaciones automáticamente desde correos
          </p>
        </div>
        <Dialog open={showNewModuleDialog} onOpenChange={setShowNewModuleDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-module">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Módulo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <NewModuleForm 
              gmailAccounts={gmailAccounts} 
              onSuccess={() => setShowNewModuleDialog(false)} 
            />
          </DialogContent>
        </Dialog>
      </div>

      {configs.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay módulos de automatización</h3>
            <p className="text-muted-foreground mb-6">
              Crea tu primer módulo para comenzar a automatizar la creación de operaciones
            </p>
            <Button onClick={() => setShowNewModuleDialog(true)} data-testid="button-create-first-module">
              <Plus className="w-4 h-4 mr-2" />
              Crear Módulo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {configs.map((config) => (
            <Card key={config.id} data-testid={`card-automation-${config.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Zap className="w-5 h-5 text-primary" />
                      <CardTitle>{config.moduleName}</CardTitle>
                      <Badge variant={config.isEnabled ? "default" : "secondary"} data-testid={`badge-status-${config.id}`}>
                        {config.isEnabled ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <CardDescription>{config.moduleDescription}</CardDescription>
                    {config.lastProcessedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Última ejecución: {new Date(config.lastProcessedAt).toLocaleString("es-MX")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={config.isEnabled}
                      onCheckedChange={(checked) => 
                        toggleConfigMutation.mutate({ id: config.id, isEnabled: checked })
                      }
                      data-testid={`switch-enable-${config.id}`}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Cuentas Gmail:</Label>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {(config.selectedGmailAccounts as string[])?.length > 0 ? (
                        (config.selectedGmailAccounts as string[]).map((accountId) => {
                          const account = gmailAccounts.find((a) => a.id === accountId);
                          return account ? (
                            <Badge key={accountId} variant="outline" className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {account.email}
                            </Badge>
                          ) : null;
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground">No hay cuentas seleccionadas</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedConfig(config)}
                      data-testid={`button-manage-${config.id}`}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Gestionar Reglas
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedConfig && (
        <ConfigManagementDialog
          config={selectedConfig}
          gmailAccounts={gmailAccounts}
          onClose={() => setSelectedConfig(null)}
        />
      )}
    </div>
  );
}

function NewModuleForm({ gmailAccounts, onSuccess }: { 
  gmailAccounts: GmailAccount[]; 
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [moduleName, setModuleName] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  const createModuleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/automation/configs", {
        moduleName,
        moduleDescription,
        isEnabled: false,
        selectedGmailAccounts: selectedAccounts,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/configs"] });
      toast({
        title: "Módulo creado",
        description: "El módulo de automatización ha sido creado correctamente.",
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el módulo",
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Nuevo Módulo de Automatización</DialogTitle>
        <DialogDescription>
          Crea un nuevo módulo para automatizar la creación de operaciones
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <Label htmlFor="moduleName">Nombre del Módulo</Label>
          <Input
            id="moduleName"
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
            placeholder="Ej: Importaciones NAVI"
            data-testid="input-module-name"
          />
        </div>
        <div>
          <Label htmlFor="moduleDescription">Descripción</Label>
          <Textarea
            id="moduleDescription"
            value={moduleDescription}
            onChange={(e) => setModuleDescription(e.target.value)}
            placeholder="Describe qué hace este módulo"
            rows={3}
            data-testid="input-module-description"
          />
        </div>
        <div>
          <Label>Cuentas Gmail a Monitorear</Label>
          <div className="space-y-2 mt-2">
            {gmailAccounts.map((account) => (
              <div key={account.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`account-${account.id}`}
                  checked={selectedAccounts.includes(account.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedAccounts([...selectedAccounts, account.id]);
                    } else {
                      setSelectedAccounts(selectedAccounts.filter((id) => id !== account.id));
                    }
                  }}
                  className="rounded border-input"
                  data-testid={`checkbox-account-${account.id}`}
                />
                <Label htmlFor={`account-${account.id}`} className="text-sm cursor-pointer">
                  {account.email}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={() => createModuleMutation.mutate()}
          disabled={!moduleName || createModuleMutation.isPending}
          data-testid="button-save-module"
        >
          {createModuleMutation.isPending ? "Creando..." : "Crear Módulo"}
        </Button>
      </DialogFooter>
    </>
  );
}

function ConfigManagementDialog({ 
  config, 
  gmailAccounts,
  onClose 
}: { 
  config: AutomationConfig; 
  gmailAccounts: GmailAccount[];
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"rules" | "logs">("rules");
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            {config.moduleName}
          </DialogTitle>
          <DialogDescription>{config.moduleDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 border-b">
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
        </div>

        <div className="py-4">
          {activeTab === "rules" && (
            <RulesTab configId={config.id} />
          )}
          {activeTab === "logs" && (
            <LogsTab configId={config.id} />
          )}
        </div>
      </DialogContent>
    </Dialog>
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
        <h3 className="font-semibold">Reglas de Automatización</h3>
        <Button size="sm" onClick={() => setShowNewRuleDialog(true)} data-testid="button-create-rule">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Regla
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card className="text-center py-8">
          <CardContent>
            <Filter className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No hay reglas configuradas</p>
            <p className="text-xs text-muted-foreground mt-1">
              Crea reglas para definir qué correos deben procesar este módulo
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
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">{rule.ruleName}</CardTitle>
                      <Badge variant={rule.isEnabled ? "default" : "secondary"} data-testid={`badge-rule-status-${rule.id}`}>
                        {rule.isEnabled ? "Activa" : "Inactiva"}
                      </Badge>
                      {rule.priority !== undefined && rule.priority > 0 && (
                        <Badge variant="outline">Prioridad: {rule.priority}</Badge>
                      )}
                    </div>
                    {rule.description && (
                      <CardDescription className="mt-1">{rule.description}</CardDescription>
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
  const [ruleName, setRuleName] = useState(rule?.ruleName || "");
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
        ruleName,
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
