import { useState } from "react";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Employee } from "@shared/schema";

interface EmployeeMultiSelectProps {
  employees: Employee[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
}

export function EmployeeMultiSelect({
  employees,
  selectedIds,
  onChange,
  placeholder = "Select employees...",
}: EmployeeMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggleEmployee = (employeeId: string) => {
    if (selectedIds.includes(employeeId)) {
      onChange(selectedIds.filter((id) => id !== employeeId));
    } else {
      onChange([...selectedIds, employeeId]);
    }
  };

  const removeEmployee = (employeeId: string) => {
    onChange(selectedIds.filter((id) => id !== employeeId));
  };

  const selectedEmployees = employees.filter((e) => selectedIds.includes(e.id));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-start"
            data-testid="button-select-employees"
          >
            {selectedIds.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <span>{selectedIds.length} employee(s) selected</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <ScrollArea className="h-64">
            <div className="p-2">
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">No employees available</p>
              ) : (
                employees.map((employee) => {
                  const isSelected = selectedIds.includes(employee.id);
                  return (
                    <div
                      key={employee.id}
                      className={`
                        flex items-center justify-between p-2 rounded-md cursor-pointer hover-elevate
                        ${isSelected ? "bg-accent" : ""}
                      `}
                      onClick={() => toggleEmployee(employee.id)}
                      data-testid={`employee-option-${employee.id}`}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{employee.position}</p>
                        <p className="text-xs text-muted-foreground">{employee.department}</p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {selectedEmployees.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedEmployees.map((employee) => (
            <Badge
              key={employee.id}
              variant="secondary"
              className="gap-1"
              data-testid={`badge-employee-${employee.id}`}
            >
              {employee.position}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeEmployee(employee.id)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
