import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Paperclip, RefreshCw, Trash2, Power } from "lucide-react";
import { format } from "date-fns";
import type { GmailAccount, GmailMessage } from "@shared/schema";

export default function GmailPage() {
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [syncRange, setSyncRange] = useState("1");

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Omit<GmailAccount, 'accessToken' | 'refreshToken'>[]>({
    queryKey: ["/api/gmail/accounts"],
  });

  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery<GmailMessage[]>({
    queryKey: ["/api/gmail/accounts", selectedAccount, "messages"],
    enabled: !!selectedAccount,
    refetchInterval: (data) => {
      // Refrescar automáticamente si hay una cuenta seleccionada y está sincronizando
      const account = accounts.find(a => a.id === selectedAccount);
      return account?.syncStatus === 'syncing' ? 3000 : false;
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/gmail/oauth/start");
      const { authUrl } = await response.json();
      const fullAuthUrl = `${authUrl}&syncRange=${syncRange}`;
      window.open(fullAuthUrl, '_blank', 'width=600,height=700');
    },
    onSuccess: () => {
      toast({
        title: "Conectando cuenta de Gmail",
        description: "Por favor completa la autorización en la ventana emergente.",
      });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/gmail/accounts"] });
      }, 3000);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      await apiRequest("DELETE", `/api/gmail/accounts/${accountId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/accounts"] });
      setSelectedAccount(null);
      toast({
        title: "Cuenta desconectada",
        description: "La cuenta de Gmail ha sido desconectada exitosamente.",
      });
    },
  });

  const toggleSyncMutation = useMutation({
    mutationFn: async (accountId: string) => {
      await apiRequest("PATCH", `/api/gmail/accounts/${accountId}/toggle-sync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/accounts"] });
      toast({
        title: "Sincronización actualizada",
        description: "El estado de sincronización ha sido actualizado.",
      });
    },
  });

  const resyncMutation = useMutation({
    mutationFn: async (accountId: string) => {
      await apiRequest("POST", `/api/gmail/accounts/${accountId}/resync`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmail/accounts"] });
      // Iniciar refetch automático de mensajes
      const intervalId = setInterval(() => {
        refetchMessages();
        queryClient.invalidateQueries({ queryKey: ["/api/gmail/accounts"] });
      }, 3000);
      
      // Detener después de 5 minutos
      setTimeout(() => clearInterval(intervalId), 300000);
      
      toast({
        title: "Sincronización iniciada",
        description: "La sincronización de correos ha iniciado. Los mensajes aparecerán gradualmente.",
      });
    },
  });

  const currentAccount = accounts.find(a => a.id === selectedAccount);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Correos de Gmail</h1>
          <p className="text-muted-foreground">Gestiona tus cuentas de Gmail y visualiza tus correos</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button data-testid="button-connect-gmail">
              <Mail className="h-4 w-4 mr-2" />
              Conectar Gmail
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conectar cuenta de Gmail</DialogTitle>
              <DialogDescription>
                Selecciona el rango de sincronización para tus correos
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rango de sincronización</label>
                <Select value={syncRange} onValueChange={setSyncRange}>
                  <SelectTrigger data-testid="select-sync-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Último mes</SelectItem>
                    <SelectItem value="2">Últimos 2 meses</SelectItem>
                    <SelectItem value="3">Últimos 3 meses</SelectItem>
                    <SelectItem value="6">Últimos 6 meses</SelectItem>
                    <SelectItem value="12">Último año</SelectItem>
                    <SelectItem value="24">Últimos 2 años</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="w-full"
                data-testid="button-confirm-connect"
              >
                {connectMutation.isPending ? "Conectando..." : "Conectar cuenta"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Cuentas conectadas</CardTitle>
            <CardDescription>
              {accounts.length} {accounts.length === 1 ? "cuenta" : "cuentas"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {accountsLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando...</p>
                ) : accounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay cuentas conectadas</p>
                ) : (
                  accounts.map((account) => (
                    <Card
                      key={account.id}
                      className={`cursor-pointer hover-elevate ${
                        selectedAccount === account.id ? "toggle-elevated" : ""
                      }`}
                      onClick={() => setSelectedAccount(account.id)}
                      data-testid={`account-${account.id}`}
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <p className="font-medium text-sm truncate">{account.email}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant={account.syncEnabled ? "default" : "secondary"}>
                                {account.syncEnabled ? "Activa" : "Pausada"}
                              </Badge>
                              <Badge variant={
                                account.syncStatus === 'completed' ? 'default' :
                                account.syncStatus === 'syncing' ? 'secondary' :
                                account.syncStatus === 'error' ? 'destructive' : 'secondary'
                              }>
                                {account.syncStatus === 'completed' ? 'Completado' :
                                account.syncStatus === 'syncing' ? 'Sincronizando' :
                                account.syncStatus === 'error' ? 'Error' : 'Nunca'}
                              </Badge>
                            </div>
                            {account.lastSyncDate && (
                              <p className="text-xs text-muted-foreground">
                                Última sync: {format(new Date(account.lastSyncDate), "dd/MM/yyyy HH:mm")}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSyncMutation.mutate(account.id);
                            }}
                            data-testid={`button-toggle-sync-${account.id}`}
                          >
                            <Power className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              resyncMutation.mutate(account.id);
                            }}
                            disabled={!account.syncEnabled || resyncMutation.isPending}
                            data-testid={`button-resync-${account.id}`}
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              disconnectMutation.mutate(account.id);
                            }}
                            data-testid={`button-disconnect-${account.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {currentAccount ? `Correos de ${currentAccount.email}` : "Selecciona una cuenta"}
              {currentAccount?.syncStatus === 'syncing' && (
                <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
              )}
            </CardTitle>
            <CardDescription>
              {messages.length} {messages.length === 1 ? "correo" : "correos"}
              {currentAccount?.syncStatus === 'syncing' && " - Sincronizando..."}
              {currentAccount?.syncStatus === 'completed' && currentAccount.lastSyncDate && 
                ` - Última sync: ${format(new Date(currentAccount.lastSyncDate), "dd/MM/yyyy HH:mm")}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedAccount ? (
              <p className="text-muted-foreground">Selecciona una cuenta para ver sus correos</p>
            ) : messagesLoading ? (
              <p className="text-muted-foreground">Cargando correos...</p>
            ) : messages.length === 0 ? (
              <p className="text-muted-foreground">No hay correos sincronizados</p>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {messages.map((message) => (
                    <Card
                      key={message.id}
                      data-testid={`message-${message.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">
                                {message.fromName || message.fromEmail}
                              </p>
                              {!message.isRead && (
                                <Badge variant="default" className="h-2 w-2 p-0 rounded-full" />
                              )}
                              {message.hasAttachments && (
                                <Paperclip className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <p className="font-medium text-sm line-clamp-1">
                              {message.subject || "(Sin asunto)"}
                            </p>
                            {message.snippet && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {message.snippet}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(message.date), "dd/MM/yy")}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      
    </div>
  );
}
