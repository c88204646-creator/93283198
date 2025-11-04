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

  const form = useForm<z.infer<typeof insertEmployeeSchema>>({
    resolver: zodResolver(insertEmployeeSchema),
    defaultValues: {
      name: "",
      email: "",
      position: "",
      department: "",
      birthdate: undefined as any,
      hireDate: undefined as any,
      status: "active",
      phone: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: EmployeeFormData) => {
      const formattedData = {
        ...data,
        hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
        birthdate: data.birthdate ? new Date(data.birthdate) : undefined,
      };
      return apiRequest("POST", "/api/employees", formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Empleado creado exitosamente" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al crear empleado", 
        description: error?.message || "Hubo un problema al crear el empleado. Por favor verifica los datos e intenta nuevamente.",
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: EmployeeFormData }) => {
      const formattedData = {
        ...data,
        hireDate: data.hireDate ? new Date(data.hireDate) : undefined,
        birthdate: data.birthdate ? new Date(data.birthdate) : undefined,
      };
      return apiRequest("PATCH", `/api/employees/${id}`, formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      setEditingEmployee(null);
      form.reset();
      toast({ title: "Empleado actualizado exitosamente" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error al actualizar empleado", 
        description: error?.message || "Hubo un problema al actualizar el empleado. Por favor verifica los datos e intenta nuevamente.",
        variant: "destructive" 
      });
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
    const formattedHireDate = employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : undefined;
    const formattedBirthdate = employee.birthdate ? new Date(employee.birthdate).toISOString().split('T')[0] : undefined;
    form.reset({
      name: employee.name,
      email: employee.email,
      position: employee.position,
      department: employee.department || "",
      status: employee.status,
      phone: employee.phone || "",
      hireDate: formattedHireDate as any,
      birthdate: formattedBirthdate as any,
    });
  };

  const columns = [
    {
      header: "Nombre",
      accessor: (row: Employee) => (
        <div>
          <div className="font-medium">{row.name}</div>
          <div className="text-sm text-muted-foreground">{row.email}</div>
        </div>
      ),
    },
    {
      header: "Puesto",
      accessor: "position" as keyof Employee,
    },
    {
      header: "Departamento",
      accessor: "department" as keyof Employee,
    },
    {
      header: "Cumpleaños",
      accessor: (row: Employee) => row.birthdate ? new Date(row.birthdate).toLocaleDateString("es-MX", { month: "long", day: "numeric" }) : "-",
    },
    {
      header: "Estado",
      accessor: (row: Employee) => (
        <Badge className={statusColors[row.status as keyof typeof statusColors]} data-testid={`status-${row.id}`}>
          {row.status}
        </Badge>
      ),
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl">{editingEmployee ? "Editar Empleado" : "Crear Empleado"}</DialogTitle>
              <DialogDescription>
                {editingEmployee ? "Actualiza la información del empleado" : "Agrega un nuevo empleado al sistema"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-name" placeholder="Juan Pérez" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} data-testid="input-email" placeholder="juan@ejemplo.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Puesto</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-position" placeholder="Gerente de Operaciones" />
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
                        <FormLabel>Departamento</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-department" placeholder="Logística" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="birthdate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Cumpleaños</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value as any} data-testid="input-birthdate" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hireDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Contratación</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value as any} data-testid="input-hire-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="on-leave">En Licencia</SelectItem>
                            <SelectItem value="terminated">Terminado</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-phone" placeholder="+52 123 456 7890" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingEmployee(null);
                      form.reset();
                    }}
                    className="w-full sm:w-auto"
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending} 
                    data-testid="button-submit"
                    className="w-full sm:w-auto"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? "Guardando..." : editingEmployee ? "Actualizar" : "Crear"}
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