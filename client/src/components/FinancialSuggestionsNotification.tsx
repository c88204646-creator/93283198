import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, DollarSign, TrendingDown, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface FinancialSuggestion {
  id: string;
  operationId: string;
  type: 'payment' | 'expense';
  sourceType: string;
  amount: string;
  currency: string;
  description: string;
  date: string;
  aiConfidence: string;
  aiAnalysis: string;
  status: string;
  createdAt: string;
}

export function FinancialSuggestionsNotification() {
  const { toast } = useToast();
  const [selectedSuggestion, setSelectedSuggestion] = useState<FinancialSuggestion | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { data: suggestions = [], isLoading } = useQuery<FinancialSuggestion[]>({
    queryKey: ['/api/financial-suggestions/pending'],
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/financial-suggestions/${id}/approve`, {
      method: 'POST'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/financial-suggestions/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      toast({
        title: "✅ Transacción aprobada",
        description: "El registro financiero ha sido creado exitosamente",
      });
      setSelectedSuggestion(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo aprobar la sugerencia",
        variant: "destructive",
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => 
      apiRequest(`/api/financial-suggestions/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/financial-suggestions/pending'] });
      toast({
        title: "Sugerencia rechazada",
        description: "La sugerencia ha sido marcada como rechazada",
      });
      setSelectedSuggestion(null);
      setShowRejectDialog(false);
      setRejectReason("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo rechazar la sugerencia",
        variant: "destructive",
      });
    }
  });

  const pendingCount = suggestions.length;

  if (isLoading) {
    return null;
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            data-testid="button-financial-suggestions"
          >
            <Bell className="h-5 w-5" />
            {pendingCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                data-testid="badge-pending-count"
              >
                {pendingCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-lg">Transacciones Detectadas</h3>
            <p className="text-sm text-muted-foreground">
              {pendingCount === 0 ? "No hay sugerencias pendientes" : `${pendingCount} transacción${pendingCount > 1 ? 'es' : ''} pendiente${pendingCount > 1 ? 's' : ''} de revisión`}
            </p>
          </div>
          <ScrollArea className="max-h-96">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="p-4 border-b hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => setSelectedSuggestion(suggestion)}
                data-testid={`suggestion-${suggestion.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 p-2 rounded-full ${
                    suggestion.type === 'payment' 
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    {suggestion.type === 'payment' ? (
                      <DollarSign className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">
                        {suggestion.type === 'payment' ? 'Pago recibido' : 'Gasto detectado'}
                      </p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {parseInt(suggestion.aiConfidence)}% confianza
                      </Badge>
                    </div>
                    <p className="text-lg font-bold mt-1">
                      {suggestion.amount} {suggestion.currency}
                    </p>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {suggestion.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(suggestion.createdAt).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {pendingCount === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No hay transacciones pendientes de revisar</p>
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {selectedSuggestion && (
        <AlertDialog open={!!selectedSuggestion} onOpenChange={() => setSelectedSuggestion(null)}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                {selectedSuggestion.type === 'payment' ? (
                  <>
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Pago Detectado
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    Gasto Detectado
                  </>
                )}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Monto</p>
                      <p className="text-2xl font-bold">
                        {selectedSuggestion.amount} {selectedSuggestion.currency}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Confianza de IA</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary h-full transition-all"
                            style={{ width: `${selectedSuggestion.aiConfidence}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold">{selectedSuggestion.aiConfidence}%</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Descripción</p>
                    <p className="text-sm">{selectedSuggestion.description}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Análisis de IA</p>
                    <div className="bg-muted p-3 rounded-lg text-sm">
                      {selectedSuggestion.aiAnalysis}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground mb-1">Fuente</p>
                      <p className="font-medium capitalize">{selectedSuggestion.sourceType.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">Fecha detectada</p>
                      <p className="font-medium">
                        {new Date(selectedSuggestion.date).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => setShowRejectDialog(true)}
                className="border-destructive text-destructive hover:bg-destructive/10"
                data-testid="button-reject"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rechazar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => approveMutation.mutate(selectedSuggestion.id)}
                disabled={approveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-approve"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {approveMutation.isPending ? 'Aprobando...' : 'Aprobar y Crear'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {showRejectDialog && selectedSuggestion && (
        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Rechazar esta sugerencia?</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-4">
                  <p>Por favor indica el motivo del rechazo (opcional):</p>
                  <Textarea
                    placeholder="Ej: Monto incorrecto, ya fue registrado manualmente, etc."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="min-h-[100px]"
                    data-testid="input-reject-reason"
                  />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowRejectDialog(false);
                setRejectReason("");
              }}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => rejectMutation.mutate({ 
                  id: selectedSuggestion.id, 
                  reason: rejectReason 
                })}
                disabled={rejectMutation.isPending}
                className="bg-destructive hover:bg-destructive/90"
                data-testid="button-confirm-reject"
              >
                {rejectMutation.isPending ? 'Rechazando...' : 'Confirmar Rechazo'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
