
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  cell?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  itemsPerPage?: number;
}

export function DataTable<T extends { id: number | string }>({
  data,
  columns,
  itemsPerPage = 10,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = data.slice(startIndex, endIndex);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-0 overflow-hidden shadow-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
              {columns.map((column, index) => (
                <TableHead 
                  key={index} 
                  className="font-semibold text-foreground/90 h-12 px-6 text-sm"
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              currentData.map((row, rowIndex) => (
                <TableRow 
                  key={row.id} 
                  className="hover:bg-muted/30 border-b border-border/50 transition-colors"
                >
                  {columns.map((column, colIndex) => {
                    const value =
                      typeof column.accessor === "function"
                        ? column.accessor(row)
                        : row[column.accessor];

                    return (
                      <TableCell key={colIndex} className="px-6 py-4">
                        {column.cell ? column.cell(value, row) : (value as React.ReactNode)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground font-medium">
            Showing {startIndex + 1} to {Math.min(endIndex, data.length)} of{" "}
            {data.length} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="h-9 w-9 p-0 rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="h-9 w-9 p-0 rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
