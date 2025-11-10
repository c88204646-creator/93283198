import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, TrendingDown, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";

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
  aiReasoning: string;
  extractedText: string;
  status: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  relatedSuggestionId?: string;
  gmailMessageId?: string;
  gmailAttachmentId?: string;
  attachmentHash?: string;
  createdAt: string;
}

interface GmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  b2FileKey?: string;
}

interface PendingSuggestionsPanelProps {
  operationId: string; // Ahora es requerido - siempre se muestra en contexto de una operación
}

export function PendingSuggestionsPanel({ operationId }: PendingSuggestionsPanelProps) {
  const { toast } = useToast();
  const [selectedSuggestion, setSelectedSuggestion] = useState<FinancialSuggestion | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  // Build query parameters - solo filtramos por operación
  const queryParams = new URLSearchParams();
  queryParams.append('operationId', operationId);

  const { data: suggestions = [], isLoading } = useQuery<FinancialSuggestion[]>({
    queryKey: ['/api/financial-suggestions/pending', operationId],
    queryFn: async () => {
      const url = `/api/financial-suggestions/pending?${queryParams.toString()}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch suggestions');
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch attachment details when a suggestion is selected
  const { data: attachment } = useQuery<GmailAttachment>({
    queryKey: ['/api/gmail/attachments', selectedSuggestion?.gmailAttachmentId],
    enabled: !!selectedSuggestion?.gmailAttachmentId,
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
        title: "Transacción aprobada",
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

  const paymentCount = suggestions.filter(s => s.type === 'payment').length;
  const expenseCount = suggestions.filter(s => s.type === 'expense').length;
  
  const title = 'Detección Automática de Transacciones';
  let description = '';
  if (suggestions.length === 0) {
    description = 'Sistema activo - No se detectaron transacciones pendientes en esta operación';
  } else if (paymentCount > 0 && expenseCount > 0) {
    description = `${paymentCount} pago${paymentCount > 1 ? 's' : ''} y ${expenseCount} gasto${expenseCount > 1 ? 's' : ''} detectados automáticamente - Pendientes de validación`;
  } else if (paymentCount > 0) {
    description = `${paymentCount} pago${paymentCount > 1 ? 's' : ''} detectado${paymentCount > 1 ? 's' : ''} automáticamente - Pendiente${paymentCount > 1 ? 's' : ''} de validación`;
  } else {
    description = `${expenseCount} gasto${expenseCount > 1 ? 's' : ''} detectado${expenseCount > 1 ? 's' : ''} automáticamente - Pendiente${expenseCount > 1 ? 's' : ''} de validación`;
  }
  
  const getEvidencePreview = (suggestion: FinancialSuggestion) => {
    if (suggestion.gmailAttachmentId) {
      return 'Evidencia: Adjunto de correo';
    } else if (suggestion.gmailMessageId) {
      return 'Evidencia: Mensaje de correo';
    }
    return 'Sin evidencia';
  };

  return (
    <>
      <Card className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            {title}
          </CardTitle>
          <CardDescription>
            {description}. Revisa y aprueba las transacciones detectadas automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-base mb-2">Sistema de Detección Activo</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                El sistema está monitoreando automáticamente los correos vinculados a esta operación en busca de facturas, 
                recibos de pago y documentos financieros. Cuando se detecte una transacción, aparecerá aquí para tu revisión.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Escaneando cada 15 minutos</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <Card
                  key={suggestion.id}
                  className="hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedSuggestion(suggestion)}
                  data-testid={`suggestion-${suggestion.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 p-2 rounded-full shrink-0 ${
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
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="font-medium text-sm">
                            {suggestion.type === 'payment' ? 'Pago recibido' : 'Gasto detectado'}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            {suggestion.isDuplicate && (
                              <Badge variant="destructive" className="text-xs flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Duplicado
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {parseInt(suggestion.aiConfidence)}% confianza
                            </Badge>
                          </div>
                        </div>
                        <p className="text-lg font-bold mt-1">
                          {suggestion.amount} {suggestion.currency}
                        </p>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {suggestion.description}
                        </p>
                        {suggestion.isDuplicate && suggestion.duplicateReason && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {suggestion.duplicateReason}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Detectado: {new Date(suggestion.createdAt).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
                  {selectedSuggestion.isDuplicate && (
                    <>
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                          <div>
                            <p className="font-semibold text-amber-900 dark:text-amber-100">Posible Duplicado</p>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                              {selectedSuggestion.duplicateReason || "Esta transacción podría estar duplicada. Revisa cuidadosamente antes de aprobar."}
                            </p>
                          </div>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}
                  
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
                      {selectedSuggestion.aiReasoning}
                    </div>
                  </div>

                  {/* Evidencia Section */}
                  {(selectedSuggestion.gmailAttachmentId || selectedSuggestion.gmailMessageId) && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-semibold">Evidencia</p>
                        <div className="space-y-2">
                          {attachment && (
                            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded">
                                    {attachment.mimeType.includes('pdf') ? (
                                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                                      </svg>
                                    ) : (
                                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
                                      </svg>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{attachment.filename}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {attachment.mimeType} • {(attachment.size / 1024).toFixed(1)} KB
                                    </p>
                                  </div>
                                  {attachment.b2FileKey && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => window.open(`/api/gmail/attachments/${selectedSuggestion.gmailAttachmentId}/download`, '_blank')}
                                      data-testid="button-view-evidence"
                                    >
                                      Ver archivo
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                          {selectedSuggestion.gmailMessageId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => window.open(`/operations/${selectedSuggestion.operationId}?tab=emails&messageId=${selectedSuggestion.gmailMessageId}`, '_blank')}
                              data-testid="button-view-email"
                            >
                              Ver correo completo
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  )}

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
