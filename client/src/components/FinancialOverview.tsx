import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, DollarSign, TrendingDown, TrendingUp } from "lucide-react";

interface FinancialOverviewProps {
  operationId: string;
}

interface FinancialSummary {
  invoicesTotal: number;
  paymentsTotal: number;
  expensesTotal: number;
  profit: number;
  currency: string | null;
}

export function FinancialOverview({ operationId }: FinancialOverviewProps) {
  const { data: financial, isLoading } = useQuery<FinancialSummary>({
    queryKey: ['/api/operations', operationId, 'financial-overview'],
  });

  const formatCurrency = (amount: number, currency?: string | null) => {
    const curr = currency || 'USD';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!financial) return null;

  const profitColor = financial.profit >= 0 ? 'text-green-600' : 'text-red-600';
  const profitBgColor = financial.profit >= 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card data-testid="card-invoices-total">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Facturas
          </CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" data-testid="text-invoices-amount">
            {formatCurrency(financial.invoicesTotal, financial.currency)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total facturado al cliente
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-payments-total">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pagos Recibidos
          </CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600" data-testid="text-payments-amount">
            {formatCurrency(financial.paymentsTotal, financial.currency)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ingresos de clientes
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-expenses-total">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Gastos
          </CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600" data-testid="text-expenses-amount">
            {formatCurrency(financial.expensesTotal, financial.currency)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Costos de la operación
          </p>
        </CardContent>
      </Card>

      <Card data-testid="card-profit" className={profitBgColor}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ganancia / Profit
          </CardTitle>
          <TrendingUp className={`h-4 w-4 ${profitColor}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${profitColor}`} data-testid="text-profit-amount">
            {formatCurrency(financial.profit, financial.currency)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pagos - Gastos
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
