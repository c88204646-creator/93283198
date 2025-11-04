import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEmployeeSchema, type Employee, type User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { z } from "zod";

const statusColors = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "on-leave": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  terminated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

type EmployeeFormData = z.infer<typeof insertEmployeeSchema>;

export default function EmployeesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(insertEmployeeSchema.extend({
      hireDate: insertEmployeeSchema.shape.hireDate,
    })),
    defaultValues: {
      userId: "",
      position: "",
      department: "",
      hireDate: new Date().toISOString().split('T')[0] as any,
      status: "active",
      phone: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: EmployeeFormData) => {
      const formattedData = {
        ...data,
        hireDate: new Date(data.hireDate),
      };
      return apiRequest("POST", "/api/employees", formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Employee created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EmployeeFormData }) => {
      const formattedData = {
        ...data,
        hireDate: new Date(data.hireDate),
      };
      return apiRequest("PATCH", `/api/employees/${id}`, formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setEditingEmployee(null);
      form.reset();
      toast({ title: "Employee updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/employees/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Employee deleted successfully" });
    },
  });

  const onSubmit = (data: EmployeeFormData) => {
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    const formattedDate = new Date(employee.hireDate).toISOString().split('T')[0];
    form.reset({
      userId: employee.userId,
      position: employee.position,
      department: employee.department,
      status: employee.status,
      phone: employee.phone || "",
      hireDate: formattedDate as any,
    });
  };

  const columns = [
    {
      header: "Name",
      accessor: (row: Employee) => {
        const user = users.find((u) => u.id === row.userId);
        return (
          <div>
            <div className="font-medium">{user?.fullName || "-"}</div>
            <div className="text-sm text-muted-foreground">{user?.email || "-"}</div>
          </div>
        );
      },
    },
    {
      header: "Position",
      accessor: "position" as keyof Employee,
    },
    {
      header: "Department",
      accessor: "department" as keyof Employee,
    },
    {
      header: "Status",
      accessor: (row: Employee) => (
        <Badge className={statusColors[row.status as keyof typeof statusColors]} data-testid={`status-${row.id}`}>
          {row.status}
        </Badge>
      ),
    },
    {
      header: "Hire Date",
      accessor: (row: Employee) => new Date(row.hireDate).toLocaleDateString(),
    },
    {
      header: "Actions",
      accessor: (row: Employee) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleEdit(row)}
            data-testid={`button-edit-${row.id}`}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteMutation.mutate(row.id)}
            data-testid={`button-delete-${row.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  const availableUsers = users.filter(
    (user) => !employees.some((emp) => emp.userId === user.id) || editingEmployee?.userId === user.id
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Employees</h1>
          <p className="text-muted-foreground mt-1">Manage your workforce and employee details</p>
        </div>
        <Dialog open={isCreateOpen || !!editingEmployee} onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingEmployee(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-employee">
              <Plus className="w-4 h-4 mr-2" />
              New Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? "Edit Employee" : "Create Employee"}</DialogTitle>
              <DialogDescription>
                {editingEmployee ? "Update employee details" : "Add a new employee to your system"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User Account</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user">
                            <SelectValue placeholder="Select user" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {availableUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.fullName} ({user.username})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-position" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-department" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="hireDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hire Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value as any} data-testid="input-hire-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on-leave">On Leave</SelectItem>
                            <SelectItem value="terminated">Terminated</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingEmployee(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                    {editingEmployee ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={employees}
        columns={columns}
        searchPlaceholder="Search employees..."
        isLoading={isLoading}
        emptyMessage="No employees found. Create your first employee record to get started."
      />
    </div>
  );
}
