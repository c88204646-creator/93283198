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

// Available automation modules
const AVAILABLE_MODULES = [
  {
    id: "operation-email-automation",
    name: "Operation Email Automation",
    description: "Automatically creates operations when emails arrive with specific patterns (e.g.: NAVI-123)",
    icon: Package,
    category: "operations",
  },
  {
    id: "invoice-email-automation",
    name: "Invoice Email Automation",
    description: "Automatically generates invoices from emails with billing information",
    icon: FileText,
    category: "invoices",
    comingSoon: true,
  },
  {
    id: "expense-receipt-automation",
    name: "Expense Receipt Automation",
    description: "Automatically records expenses when emails arrive with attached receipts",
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

  // Get active configuration for each module
  const getModuleConfig = (moduleId: string) => {
    return configs.find((c) => c.moduleName === moduleId);
  };

  if (configsLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="loading-automation">
        <div className="text-muted-foreground">Loading automations...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-automation-title">Automation Modules</h1>
        <p className="text-muted-foreground">
          Activate and configure modules to automate processes from emails
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
                    <Badge variant="secondary">Coming Soon</Badge>
                  ) : (
                    <Badge variant={isActive ? "default" : "outline"} data-testid={`badge-status-${module.id}`}>
                      {isActive ? "Active" : "Inactive"}
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
                    {config ? "Configure" : "Activate"}
                  </Button>
                )}
                {module.comingSoon && (
                  <Button className="w-full" variant="secondary" disabled>
                    Coming Soon
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
  const [autoDetectPayments, setAutoDetectPayments] = useState<boolean>(
    config?.autoDetectPayments || false
  );
  const [autoDetectExpenses, setAutoDetectExpenses] = useState<boolean>(
    config?.autoDetectExpenses || false
  );
  const [autoAssignClients, setAutoAssignClients] = useState<boolean>(
    config?.autoAssignClients || false
  );
  const [customFolderNames, setCustomFolderNames] = useState<Record<string, string>>(
    (config?.customFolderNames as Record<string, string>) || {}
  );
  const [companyName, setCompanyName] = useState<string>(
    config?.companyName || ''
  );
  const [companyDomain, setCompanyDomain] = useState<string>(
    config?.companyDomain || ''
  );
  const [employeeEmails, setEmployeeEmails] = useState<string>(
    config?.employeeEmails ? (config.employeeEmails as string[]).join(', ') : ''
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
        autoDetectPayments,
        autoDetectExpenses,
        autoAssignClients,
        customFolderNames: sanitizedNames,
        companyName: companyName.trim(),
        companyDomain: companyDomain.trim(),
        employeeEmails: employeeEmails.split(',').map(e => e.trim()).filter(e => e),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/configs"] });
      toast({
        title: "Module activated",
        description: "The module has been activated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not activate the module",
        variant: "destructive",
      });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ isEnabled, accounts, employees, attachments, tasks, notes, optimization, detectPayments, detectExpenses, folderNames, compName, compDomain, empEmails }: { isEnabled?: boolean; accounts?: string[]; employees?: string[]; attachments?: boolean; tasks?: string; notes?: string; optimization?: string; detectPayments?: boolean; detectExpenses?: boolean; folderNames?: Record<string, string>; compName?: string; compDomain?: string; empEmails?: string[] }) => {
      return apiRequest("PATCH", `/api/automation/configs/${config!.id}`, {
        isEnabled,
        selectedGmailAccounts: accounts,
        defaultEmployees: employees,
        processAttachments: attachments,
        autoCreateTasks: tasks,
        autoCreateNotes: notes,
        aiOptimizationLevel: optimization,
        autoDetectPayments: detectPayments,
        autoDetectExpenses: detectExpenses,
        autoAssignClients: assignClients,
        customFolderNames: folderNames,
        companyName: compName,
        companyDomain: compDomain,
        employeeEmails: empEmails,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automation/configs"] });
      toast({
        title: "Configuration updated",
        description: "Changes have been saved successfully.",
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
        title: "Module deactivated",
        description: "The module has been completely deactivated.",
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
      updateConfigMutation.mutate({ 
        accounts: selectedAccounts, 
        employees: selectedEmployees, 
        attachments: processAttachments, 
        tasks: autoCreateTasks, 
        notes: autoCreateNotes, 
        optimization: aiOptimizationLevel, 
        detectPayments: autoDetectPayments, 
        detectExpenses: autoDetectExpenses, 
        assignClients: autoAssignClients,
        folderNames: sanitizedFolderNames,
        compName: companyName.trim(),
        compDomain: companyDomain.trim(),
        empEmails: employeeEmails.split(',').map(e => e.trim()).filter(e => e),
      });
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
            Settings
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
                Rules
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
              autoDetectPayments={autoDetectPayments}
              autoDetectExpenses={autoDetectExpenses}
              autoAssignClients={autoAssignClients}
              companyName={companyName}
              companyDomain={companyDomain}
              employeeEmails={employeeEmails}
              onAccountsChange={setSelectedAccounts}
              onEmployeesChange={setSelectedEmployees}
              onProcessAttachmentsChange={setProcessAttachments}
              onAutoCreateTasksChange={setAutoCreateTasks}
              onAutoCreateNotesChange={setAutoCreateNotes}
              onAiOptimizationLevelChange={setAiOptimizationLevel}
              onAutoDetectPaymentsChange={setAutoDetectPayments}
              onAutoDetectExpensesChange={setAutoDetectExpenses}
              onAutoAssignClientsChange={setAutoAssignClients}
              onCompanyNameChange={setCompanyName}
              onCompanyDomainChange={setCompanyDomain}
              onEmployeeEmailsChange={setEmployeeEmails}
              customFolderNames={customFolderNames}
              onCustomFolderNamesChange={setCustomFolderNames}
              onSave={handleSaveSettings}
              onDelete={() => {
                if (confirm("Deactivate this module completely?")) {
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
  autoDetectPayments,
  autoDetectExpenses,
  autoAssignClients,
  companyName,
  companyDomain,
  employeeEmails,
  customFolderNames,
  onAccountsChange,
  onEmployeesChange,
  onProcessAttachmentsChange,
  onAutoCreateTasksChange,
  onAutoCreateNotesChange,
  onAiOptimizationLevelChange,
  onAutoDetectPaymentsChange,
  onAutoDetectExpensesChange,
  onAutoAssignClientsChange,
  onCompanyNameChange,
  onCompanyDomainChange,
  onEmployeeEmailsChange,
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
  autoDetectPayments: boolean;
  autoDetectExpenses: boolean;
  autoAssignClients: boolean;
  companyName: string;
  companyDomain: string;
  employeeEmails: string;
  customFolderNames: Record<string, string>;
  onAccountsChange: (accounts: string[]) => void;
  onEmployeesChange: (employees: string[]) => void;
  onProcessAttachmentsChange: (enabled: boolean) => void;
  onAutoCreateTasksChange: (mode: string) => void;
  onAutoCreateNotesChange: (mode: string) => void;
  onAiOptimizationLevelChange: (level: string) => void;
  onAutoDetectPaymentsChange: (enabled: boolean) => void;
  onAutoDetectExpensesChange: (enabled: boolean) => void;
  onAutoAssignClientsChange: (enabled: boolean) => void;
  onCompanyNameChange: (name: string) => void;
  onCompanyDomainChange: (domain: string) => void;
  onEmployeeEmailsChange: (emails: string) => void;
  onCustomFolderNamesChange: (names: Record<string, string>) => void;
  onSave: () => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold mb-3 block">Gmail Accounts to Monitor</Label>
        <p className="text-sm text-muted-foreground mb-4">
          Select the Gmail accounts from which this module will process emails
        </p>
        {gmailAccounts.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="py-6 text-center">
              <Mail className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No Gmail accounts connected. Go to the Gmail section to connect an account.
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
                  <Badge variant="secondary" className="text-xs">Syncing</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t pt-6">
        <Label className="text-base font-semibold mb-3 block">Company Context (for AI)</Label>
        <p className="text-sm text-muted-foreground mb-4">
          Help the AI identify internal vs external emails to generate more accurate tasks and notes
        </p>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="company-name" className="text-sm mb-2 block">Company Name</Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(e) => onCompanyNameChange(e.target.value)}
              placeholder="e.g., Navicargo Logistics"
              data-testid="input-company-name"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Your company name for better context
            </p>
          </div>

          <div>
            <Label htmlFor="company-domain" className="text-sm mb-2 block">Company Email Domain</Label>
            <Input
              id="company-domain"
              value={companyDomain}
              onChange={(e) => onCompanyDomainChange(e.target.value)}
              placeholder="e.g., navicargologistics.com"
              data-testid="input-company-domain"
            />
            <p className="text-xs text-muted-foreground mt-1">
              If all employee emails end with this domain (e.g., @navicargologistics.com), enter it here
            </p>
          </div>

          <div>
            <Label htmlFor="employee-emails" className="text-sm mb-2 block">Employee Emails (Optional)</Label>
            <Textarea
              id="employee-emails"
              value={employeeEmails}
              onChange={(e) => onEmployeeEmailsChange(e.target.value)}
              placeholder="email1@company.com, email2@company.com"
              rows={3}
              data-testid="input-employee-emails"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Specific employee emails separated by commas. Use this if employees don't all use the same domain.
            </p>
          </div>
        </div>
      </div>

      <div>
        <Label className="text-base font-semibold mb-3 block">Default Assigned Employees</Label>
        <p className="text-sm text-muted-foreground mb-4">
          Select the employees that will be automatically assigned to created operations
        </p>
        {employees.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="py-6 text-center">
              <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No employees available. Create employees in the Employees section.
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
            <Label className="text-base font-semibold">Process Email Attachments</Label>
            <p className="text-sm text-muted-foreground mt-1">
              When enabled, email attachments will be automatically downloaded
              and organized into folders by category (Payments, Expenses, Photos, Invoices, Contracts, Documents)
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
            <Label className="text-base font-semibold mb-3 block">📁 Custom Folder Names</Label>
            <p className="text-sm text-muted-foreground mb-4">
              Configure custom names for folders where attachments will be automatically organized
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
              💡 Leave blank to use default names
            </p>
          </div>
        )}

        <div className="pt-4 border-t">
          <Label className="text-base font-semibold mb-3 block">🤖 Gemini AI Automation</Label>
          <p className="text-sm text-muted-foreground mb-4">
            Use artificial intelligence to analyze email threads and automatically create relevant tasks and notes
          </p>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium mb-2 block">Automatically Create Tasks</Label>
              <Select value={autoCreateTasks} onValueChange={onAutoCreateTasksChange}>
                <SelectTrigger data-testid="select-auto-tasks">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">🚫 Disabled</SelectItem>
                  <SelectItem value="basic">✅ Basic (no AI)</SelectItem>
                  <SelectItem value="smart_ai">🤖 Smart with AI</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {autoCreateTasks === 'smart_ai' && '✨ Uses Gemini AI to detect pending tasks in emails'}
                {autoCreateTasks === 'basic' && '📋 Extracts tasks from simple keywords'}
                {autoCreateTasks === 'disabled' && 'Tasks will not be created automatically'}
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Automatically Create Notes</Label>
              <Select value={autoCreateNotes} onValueChange={onAutoCreateNotesChange}>
                <SelectTrigger data-testid="select-auto-notes">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled">🚫 Disabled</SelectItem>
                  <SelectItem value="basic">✅ Basic (no AI)</SelectItem>
                  <SelectItem value="smart_ai">🤖 Smart with AI</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {autoCreateNotes === 'smart_ai' && '✨ Uses Gemini AI to extract important information'}
                {autoCreateNotes === 'basic' && '📝 Creates simple email summaries'}
                {autoCreateNotes === 'disabled' && 'Notes will not be created automatically'}
              </p>
            </div>
          </div>

          {(autoCreateTasks === 'smart_ai' || autoCreateNotes === 'smart_ai') && (
            <div className="mt-4 p-3 bg-primary/5 rounded-lg">
              <Label className="text-sm font-medium mb-2 block">API Optimization Level</Label>
              <Select value={aiOptimizationLevel} onValueChange={onAiOptimizationLevelChange}>
                <SelectTrigger data-testid="select-ai-optimization">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">🔋 High (80% usage reduction)</SelectItem>
                  <SelectItem value="medium">⚡ Medium (50% usage reduction)</SelectItem>
                  <SelectItem value="low">💨 Low (20% usage reduction)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                💡 <strong>Recommended: High</strong> - Significantly reduces API consumption through smart caching,
                deduplication, and differential analysis without affecting quality
              </p>
            </div>
          )}

          <div className="mt-6 p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              💰 AI Financial Detection (NEW)
              <Badge variant="outline" className="text-xs">Beta</Badge>
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              Automatically detects payments and expenses from PDF attachments in emails using AI
            </p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Auto-detect Payments</Label>
                  <p className="text-xs text-muted-foreground">
                    Detect when clients send payment receipts or confirmation emails
                  </p>
                </div>
                <Switch
                  checked={autoDetectPayments}
                  onCheckedChange={onAutoDetectPaymentsChange}
                  data-testid="switch-auto-detect-payments"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Auto-detect Expenses</Label>
                  <p className="text-xs text-muted-foreground">
                    Detect when company makes payments (invoices, receipts, transfers)
                  </p>
                </div>
                <Switch
                  checked={autoDetectExpenses}
                  onCheckedChange={onAutoDetectExpensesChange}
                  data-testid="switch-auto-detect-expenses"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Auto-assign Clients</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically detect and assign clients from invoice PDFs (Facturama)
                  </p>
                </div>
                <Switch
                  checked={autoAssignClients}
                  onCheckedChange={onAutoAssignClientsChange}
                  data-testid="switch-auto-assign-clients"
                />
              </div>
              {(autoDetectPayments || autoDetectExpenses || autoAssignClients) && (
                <div className="mt-3 p-3 bg-blue-500/5 rounded-md text-xs text-muted-foreground">
                  ℹ️ {autoAssignClients && 'Client assignments will be made automatically from invoice data. '} 
                  {(autoDetectPayments || autoDetectExpenses) && 'Detected transactions will require your approval before being added to the system.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {config && config.lastProcessedAt && (
        <div className="text-sm text-muted-foreground">
          Last execution: {new Date(config.lastProcessedAt).toLocaleString("en-US")}
        </div>
      )}

      <div className="flex gap-2 pt-4 border-t">
        <Button
          onClick={onSave}
          disabled={selectedAccounts.length === 0 || isSaving}
          data-testid="button-save-settings"
        >
          {isSaving ? "Saving..." : config ? "Save Changes" : "Activate Module"}
        </Button>
        {config && (
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={isDeleting}
            data-testid="button-delete-config"
          >
            {isDeleting ? "Deleting..." : "Deactivate Module"}
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
    return <div className="text-center py-8 text-muted-foreground">Loading rules...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold">Automation Rules</h3>
          <p className="text-sm text-muted-foreground">Define which emails this module should process</p>
        </div>
        <Button size="sm" onClick={() => setShowNewRuleDialog(true)} data-testid="button-create-rule">
          <Filter className="w-4 h-4 mr-2" />
          New Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card className="text-center py-8">
          <CardContent>
            <Filter className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No rules configured</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create rules to define which emails should be processed
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
                        {rule.isEnabled ? "Active" : "Inactive"}
                      </Badge>
                      {rule.priority !== undefined && rule.priority > 0 && (
                        <Badge variant="outline">Priority: {rule.priority}</Badge>
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
                        if (confirm("Delete this rule?")) {
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
        description: error.message || "Could not save the rule",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? "Edit Rule" : "New Rule"}</DialogTitle>
          <DialogDescription>
            Configure the conditions to automatically process emails
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
            <Label htmlFor="priority">Priority</Label>
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
            {saveMutation.isPending ? "Saving..." : "Save"}
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
    return <div className="text-center py-8 text-muted-foreground">Loading logs...</div>;
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Historial de Ejecuciones</h3>
      
      {logs.length === 0 ? (
        <Card className="text-center py-8">
          <CardContent>
            <Activity className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No logs recorded</p>
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
                        {JSON.stringify(log.details as any)}
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
