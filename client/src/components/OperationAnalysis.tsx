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
      <Card className="border border-blue-300/30 dark:border-blue-700/30 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 dark:from-blue-950/30 dark:via-gray-900 dark:to-blue-950/20 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-3 py-2 border-b border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-md">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="font-semibold text-xs bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Asistente IA</h3>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          <span className="ml-2 text-[11px] text-muted-foreground">Cargando análisis...</span>
        </div>
      </Card>
    );
  }

  // Error state
  if (error || analysis?.status === 'error') {
    return (
      <Card className="border border-orange-300/30 dark:border-orange-700/30 bg-gradient-to-br from-orange-50/50 via-white to-orange-50/30 dark:from-orange-950/30 dark:via-gray-900 dark:to-orange-950/20 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-3 py-2 border-b border-orange-200/50 dark:border-orange-800/30 bg-gradient-to-r from-orange-500/5 to-red-500/5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-full bg-gradient-to-br from-orange-500 to-red-600 shadow-md">
              <AlertCircle className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="font-semibold text-xs bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">Asistente IA</h3>
          </div>
        </div>
        <div className="p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground font-light">
            No pude generar el análisis:
          </p>
          <ul className="text-[10px] text-muted-foreground/80 list-disc list-inside space-y-0.5 pl-2">
            <li>Servicio de IA temporalmente no disponible</li>
            <li>Datos insuficientes para analizar</li>
            <li>Problemas de conectividad</li>
          </ul>
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline" size="sm" className="mt-2 h-7 text-[10px]">
            <RefreshCw className={`w-3 h-3 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Reintentar
          </Button>
        </div>
      </Card>
    );
  }

  // Generating state
  if (analysis?.status === 'generating') {
    return (
      <Card className="border border-blue-300/30 dark:border-blue-700/30 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 dark:from-blue-950/30 dark:via-gray-900 dark:to-blue-950/20 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-3 py-2 border-b border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-md animate-pulse">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="font-semibold text-xs bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Analizando...</h3>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-3">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
          <div>
            <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Procesando emails y datos de la operación</p>
            <p className="text-[9px] text-muted-foreground/80 mt-0.5">Esto toma entre 5-15 segundos...</p>
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
    <Card className="border border-blue-300/30 dark:border-blue-700/30 bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 dark:from-blue-950/30 dark:via-gray-900 dark:to-blue-950/20 overflow-hidden shadow-sm" data-testid="card-operation-analysis">
      {/* Header - Ultra compacto con estilo chat */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-blue-200/50 dark:border-blue-800/30 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="p-1 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-md">
              <Brain className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white dark:border-gray-900"></div>
          </div>
          <div>
            <h3 className="font-semibold text-xs bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Asistente IA</h3>
            <p className="text-[9px] text-muted-foreground flex items-center gap-1">
              <Mail className="w-2 h-2" />
              {analysis.emailsAnalyzed} {analysis.emailsAnalyzed === 1 ? 'email analizado' : 'emails analizados'}
            </p>
          </div>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={isRefreshing} 
          variant="ghost" 
          size="icon"
          className="h-6 w-6 shrink-0 hover:bg-blue-100 dark:hover:bg-blue-900/30"
          data-testid="button-refresh-analysis"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Analysis Content - Estilo chat compacto */}
      <ScrollArea className="h-[240px]">
        <div className="p-3 space-y-2">
          <div className="bg-white/60 dark:bg-gray-800/40 rounded-lg p-3 border border-blue-100/50 dark:border-blue-900/30 shadow-sm">
            <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-gray-700 dark:text-gray-300 font-light">
              {analysis.analysis}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer - Minimalista */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-blue-200/30 dark:border-blue-800/20 bg-gradient-to-r from-gray-50/50 to-blue-50/30 dark:from-gray-900/50 dark:to-blue-950/20">
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground/80">
          <Clock className="w-2 h-2" />
          {format(new Date(analysis.generatedAt), "dd/MM/yy HH:mm")}
        </div>
        <div className="text-[9px] text-muted-foreground/70">
          Expira {format(new Date(analysis.expiresAt), "HH:mm")}
        </div>
      </div>
    </Card>
  );
}
