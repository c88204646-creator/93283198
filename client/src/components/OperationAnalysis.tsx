import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, RefreshCw, Clock, Mail, AlertCircle, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { OperationAnalysis } from "@shared/schema";
import { format } from "date-fns";

interface OperationAnalysisProps {
  operationId: string;
}

export function OperationAnalysisComponent({ operationId }: OperationAnalysisProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch analysis
  const { data: analysis, isLoading, error } = useQuery<OperationAnalysis>({
    queryKey: [`/api/operations/${operationId}/analysis`],
    refetchInterval: (data) => {
      // Auto-refresh if generating
      if (data?.status === 'generating') {
        return 3000; // Poll every 3 seconds
      }
      return false; // No auto-refresh
    },
  });

  // Refresh mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/operations/${operationId}/analysis/refresh`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/operations/${operationId}/analysis`] });
      setIsRefreshing(false);
    },
    onError: (error) => {
      console.error('Failed to refresh analysis:', error);
      setIsRefreshing(false);
    }
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshMutation.mutate();
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 dark:border-blue-800 bg-blue-100/50 dark:bg-blue-900/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500 dark:bg-blue-600 shadow-sm">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-sm">Asistente IA de Operación</h3>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="ml-3 text-sm text-muted-foreground">Cargando análisis...</span>
        </div>
      </Card>
    );
  }

  // Error state
  if (error || analysis?.status === 'error') {
    return (
      <Card className="border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950 dark:to-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-orange-200 dark:border-orange-800 bg-orange-100/50 dark:bg-orange-900/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-orange-500 dark:bg-orange-600 shadow-sm">
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-sm">Asistente IA - Error</h3>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            No se pudo generar el análisis:
          </p>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 pl-2">
            <li>Servicio de IA temporalmente no disponible</li>
            <li>Datos insuficientes para analizar</li>
            <li>Problemas de conectividad</li>
          </ul>
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline" size="sm" className="mt-2">
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  // Generating state
  if (analysis?.status === 'generating') {
    return (
      <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-gray-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 dark:border-blue-800 bg-blue-100/50 dark:bg-blue-900/30">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500 dark:bg-blue-600 shadow-sm animate-pulse">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-semibold text-sm">Analizando operación...</h3>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500 shrink-0" />
          <div>
            <p className="text-sm font-medium">Analizando emails vinculados y datos de la operación</p>
            <p className="text-xs text-muted-foreground mt-0.5">Esto toma entre 5-15 segundos...</p>
          </div>
        </div>
      </Card>
    );
  }

  // Success state - Show analysis
  if (!analysis) {
    return null;
  }

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-gray-900 overflow-hidden" data-testid="card-operation-analysis">
      {/* Header - Compacto */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200 dark:border-blue-800 bg-blue-100/50 dark:bg-blue-900/30">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-500 dark:bg-blue-600 shadow-sm">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Asistente IA de Operación</h3>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Mail className="w-2.5 h-2.5" />
              {analysis.emailsAnalyzed} {analysis.emailsAnalyzed === 1 ? 'email' : 'emails'}
            </p>
          </div>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={isRefreshing} 
          variant="ghost" 
          size="icon"
          className="h-7 w-7 shrink-0"
          data-testid="button-refresh-analysis"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Analysis Content - Con altura fija y scroll */}
      <ScrollArea className="h-[280px]">
        <div className="p-4">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {analysis.analysis}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer - Compacto */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-blue-200 dark:border-blue-800 bg-muted/20">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="w-2.5 h-2.5" />
          {format(new Date(analysis.generatedAt), "dd/MM/yy HH:mm")}
        </div>
        <div className="text-[10px] text-muted-foreground">
          Caduca {format(new Date(analysis.expiresAt), "HH:mm")}
        </div>
      </div>
    </Card>
  );
}
