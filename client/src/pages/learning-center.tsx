import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, TrendingUp, Target, Database, Award, Activity } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function LearningCenter() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/knowledge-base/stats'],
  });

  const { data: allEntries, isLoading: entriesLoading } = useQuery({
    queryKey: ['/api/knowledge-base'],
  });

  const financialDetection = allEntries?.filter((e: any) => e.type === 'financial_detection') || [];
  const operationAnalysis = allEntries?.filter((e: any) => e.type === 'operation') || [];
  const bankAnalysis = allEntries?.filter((e: any) => e.type === 'bank_account') || [];

  if (statsLoading || entriesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Brain className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-muted-foreground">Cargando centro de aprendizaje...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
                <Brain className="w-8 h-8 text-primary" />
                Centro de Aprendizaje
              </h1>
              <p className="text-muted-foreground mt-1">
                Sistema de aprendizaje automático que mejora con cada operación
              </p>
            </div>
            <Badge variant="outline" className="text-base px-4 py-2">
              <Activity className="w-4 h-4 mr-2" />
              100% Open Source
            </Badge>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-total-patterns">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Patrones Totales</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalPatterns || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.activePatterns || 0} activos
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-reused-knowledge">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conocimiento Reutilizado</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalReused || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.apiCallsSaved || 0} llamadas API ahorradas
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-accuracy-rate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasa de Precisión</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.avgAccuracy || 0}%</div>
                <Progress value={stats?.avgAccuracy || 0} className="mt-2" />
              </CardContent>
            </Card>

            <Card data-testid="card-approval-rate">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasa de Aprobación</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.avgApprovalRate || 0}%</div>
                <Progress value={stats?.avgApprovalRate || 0} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Tabs for different learning types */}
          <Tabs defaultValue="financial" className="space-y-4">
            <TabsList>
              <TabsTrigger value="financial" data-testid="tab-financial-detection">
                Detección Financiera ({financialDetection.length})
              </TabsTrigger>
              <TabsTrigger value="operations" data-testid="tab-operation-analysis">
                Análisis de Operaciones ({operationAnalysis.length})
              </TabsTrigger>
              <TabsTrigger value="banking" data-testid="tab-bank-analysis">
                Análisis Bancario ({bankAnalysis.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="financial" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Patrones de Detección Financiera</CardTitle>
                  <CardDescription>
                    Aprende de cada pago y gasto aprobado/rechazado para mejorar la precisión
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {financialDetection.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Aún no hay patrones de detección financiera.</p>
                      <p className="text-sm mt-1">El sistema comenzará a aprender cuando apruebes o rechaces sugerencias.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {financialDetection.map((pattern: any) => (
                        <Card key={pattern.id} className="hover-elevate" data-testid={`pattern-${pattern.id}`}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                                  <Badge variant={pattern.transactionType === 'payment' ? 'default' : 'secondary'}>
                                    {pattern.transactionType === 'payment' ? 'Pago' : 'Gasto'}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    Método: {pattern.detectionMethod}
                                  </span>
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-1 break-words">
                                  Patrón: {pattern.detectionPattern || 'N/A'}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Precisión</div>
                                  <div className="text-sm font-semibold">{pattern.accuracyScore}%</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Aprobación</div>
                                  <div className="text-sm font-semibold">{pattern.approvalRate}%</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Calidad</div>
                                  <div className="text-sm font-semibold">{pattern.qualityScore}/10</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Usos</div>
                                  <div className="text-sm font-semibold">{pattern.usageCount}</div>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          {pattern.tags && pattern.tags.length > 0 && (
                            <CardContent className="pt-0">
                              <div className="flex flex-wrap gap-1">
                                {pattern.tags.map((tag: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="operations" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Análisis de Operaciones Reutilizados</CardTitle>
                  <CardDescription>
                    Análisis previos que se reutilizan para operaciones similares
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {operationAnalysis.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Aún no hay análisis de operaciones reutilizables.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {operationAnalysis.map((knowledge: any) => (
                        <Card key={knowledge.id} className="hover-elevate" data-testid={`knowledge-${knowledge.id}`}>
                          <CardHeader>
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base">
                                  {knowledge.operationType || 'N/A'} - {knowledge.projectCategory || 'N/A'}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Modo: {knowledge.shippingMode || 'N/A'}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Calidad</div>
                                  <div className="text-sm font-semibold">{knowledge.qualityScore}/10</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Reutilizado</div>
                                  <div className="text-sm font-semibold">{knowledge.usageCount}x</div>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="banking" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Análisis Bancarios Reutilizados</CardTitle>
                  <CardDescription>
                    Análisis financieros previos reutilizados para cuentas similares
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bankAnalysis.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Aún no hay análisis bancarios reutilizables.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bankAnalysis.map((knowledge: any) => (
                        <Card key={knowledge.id} className="hover-elevate" data-testid={`bank-knowledge-${knowledge.id}`}>
                          <CardHeader>
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base">
                                  {knowledge.accountType || 'N/A'} - {knowledge.currency}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {knowledge.transactionCount} transacciones analizadas
                                </p>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Calidad</div>
                                  <div className="text-sm font-semibold">{knowledge.qualityScore}/10</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Reutilizado</div>
                                  <div className="text-sm font-semibold">{knowledge.usageCount}x</div>
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
