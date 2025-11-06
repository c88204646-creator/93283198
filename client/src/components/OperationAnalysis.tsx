import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      <Card className="p-6 border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-gray-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
            <Brain className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          </div>
          <h3 className="font-semibold text-lg">AI Assistant - Operation Analysis</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-muted-foreground">Loading analysis...</span>
        </div>
      </Card>
    );
  }

  // Error state
  if (error || analysis?.status === 'error') {
    return (
      <Card className="p-6 border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-white dark:from-orange-950 dark:to-gray-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-300" />
          </div>
          <h3 className="font-semibold text-lg">AI Assistant - Operation Analysis</h3>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Failed to generate analysis. This could be due to:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Temporary AI service unavailability</li>
            <li>Insufficient data to analyze</li>
            <li>Network connectivity issues</li>
          </ul>
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline" size="sm" className="mt-3">
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  // Generating state
  if (analysis?.status === 'generating') {
    return (
      <Card className="p-6 border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-gray-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900 animate-pulse">
            <Brain className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          </div>
          <h3 className="font-semibold text-lg">AI Assistant - Analyzing Operation...</h3>
        </div>
        <div className="flex items-center gap-3 py-6">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <div>
            <p className="text-sm font-medium">Analyzing linked emails and operation data</p>
            <p className="text-xs text-muted-foreground mt-1">This usually takes 5-15 seconds...</p>
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
    <Card className="p-6 border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950 dark:to-gray-900" data-testid="card-operation-analysis">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
            <Brain className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">AI Assistant - Operation Analysis</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
              <Mail className="w-3 h-3" />
              Based on {analysis.emailsAnalyzed} linked {analysis.emailsAnalyzed === 1 ? 'email' : 'emails'}
            </p>
          </div>
        </div>
        <Button 
          onClick={handleRefresh} 
          disabled={isRefreshing} 
          variant="ghost" 
          size="sm"
          className="shrink-0"
          data-testid="button-refresh-analysis"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Analysis Content */}
      <div className="prose prose-sm max-w-none dark:prose-invert mb-4">
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {analysis.analysis}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Generated {format(new Date(analysis.generatedAt), "PPp")}
        </div>
        <div>
          Expires {format(new Date(analysis.expiresAt), "p")}
        </div>
      </div>
    </Card>
  );
}
