import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { EmployeeMultiSelect } from "@/components/employee-multi-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertOperationSchema, type Operation, type Client, type Employee } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { z } from "zod";

const statusColors = {
  planning: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "in-progress": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const priorityColors = {
  low: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

type OperationFormData = z.infer<typeof insertOperationSchema>;

export default function OperationsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOperation, setEditingOperation] = useState<Operation | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: operations = [], isLoading } = useQuery<Operation[]>({
    queryKey: ["/api/operations"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const form = useForm<OperationFormData>({
    resolver: zodResolver(insertOperationSchema.extend({
      endDate: insertOperationSchema.shape.endDate.nullable(),
      clientId: insertOperationSchema.shape.clientId.nullable(),
      pickUpDate: insertOperationSchema.shape.pickUpDate.nullable(),
      etd: insertOperationSchema.shape.etd.nullable(),
      eta: insertOperationSchema.shape.eta.nullable(),
    })),
    defaultValues: {
      name: "",
      description: "",
      status: "planning",
      priority: "medium",
      clientId: null,
      startDate: null,
      endDate: null,
      projectCategory: "",
      operationType: "",
      shippingMode: "",
      insurance: "",
      projectCurrency: "USD",
      courier: "",
      pickUpAddress: "",
      deliveryAddress: "",
      bookingTracking: "",
      pickUpDate: null,
      etd: null,
      eta: null,
      mblAwb: "",
      hblAwb: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: OperationFormData) => apiRequest("POST", "/api/operations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Operation created successfully" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: OperationFormData }) =>
      apiRequest("PATCH", `/api/operations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setEditingOperation(null);
      form.reset();
      toast({ title: "Operation updated successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/operations/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Operation deleted successfully" });
    },
  });

  const onSubmit = (data: OperationFormData) => {
    const formattedData: any = {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      pickUpDate: data.pickUpDate ? new Date(data.pickUpDate) : null,
      etd: data.etd ? new Date(data.etd) : null,
      eta: data.eta ? new Date(data.eta) : null,
      courier: data.courier || null,
      pickUpAddress: data.pickUpAddress || null,
      deliveryAddress: data.deliveryAddress || null,
      bookingTracking: data.bookingTracking || null,
      mblAwb: data.mblAwb || null,
      hblAwb: data.hblAwb || null,
      employeeIds: selectedEmployeeIds,
    };

    if (editingOperation) {
      updateMutation.mutate({ id: editingOperation.id, data: formattedData });
    } else {
      createMutation.mutate(formattedData);
    }
  };

  const handleEdit = (operation: any) => {
    setEditingOperation(operation);
    setSelectedEmployeeIds(operation.employeeIds || []);
    form.reset({
      name: operation.name,
      description: operation.description || "",
      status: operation.status,
      priority: operation.priority,
      clientId: operation.clientId,
      startDate: operation.startDate ? new Date(operation.startDate).toISOString().split('T')[0] as any : null,
      endDate: operation.endDate ? new Date(operation.endDate).toISOString().split('T')[0] as any : null,
      projectCategory: operation.projectCategory,
      operationType: operation.operationType,
      shippingMode: operation.shippingMode,
      insurance: operation.insurance,
      projectCurrency: operation.projectCurrency,
      courier: operation.courier || "",
      pickUpAddress: operation.pickUpAddress || "",
      deliveryAddress: operation.deliveryAddress || "",
      bookingTracking: operation.bookingTracking || "",
      pickUpDate: operation.pickUpDate ? new Date(operation.pickUpDate).toISOString().split('T')[0] as any : null,
      etd: operation.etd ? new Date(operation.etd).toISOString().split('T')[0] as any : null,
      eta: operation.eta ? new Date(operation.eta).toISOString().split('T')[0] as any : null,
      mblAwb: operation.mblAwb || "",
      hblAwb: operation.hblAwb || "",
    });
  };

  const columns = [
    {
      header: "Shipment",
      accessor: (row: Operation) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.bookingTracking && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Link2 className="w-3 h-3" />
              {row.bookingTracking}
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Type / Mode",
      accessor: (row: Operation) => (
        <div className="space-y-1">
          <div className="text-sm font-medium">{row.operationType}</div>
          <div className="text-xs text-muted-foreground capitalize">{row.shippingMode}</div>
        </div>
      ),
    },
    {
      header: "Status",
      accessor: (row: Operation) => (
        <Badge className={statusColors[row.status as keyof typeof statusColors]} data-testid={`status-${row.id}`}>
          {row.status}
        </Badge>
      ),
    },
    {
      header: "Client",
      accessor: (row: Operation) => {
        const client = clients.find((c) => c.id === row.clientId);
        return client ? client.name : "-";
      },
    },
    {
      header: "ETD / ETA",
      accessor: (row: Operation) => (
        <div className="text-sm space-y-1">
          {row.etd && (
            <div className="text-muted-foreground">
              ETD: {new Date(row.etd).toLocaleDateString()}
            </div>
          )}
          {row.eta && (
            <div className="text-foreground font-medium">
              ETA: {new Date(row.eta).toLocaleDateString()}
            </div>
          )}
          {!row.etd && !row.eta && <span className="text-muted-foreground">-</span>}
        </div>
      ),
    },
    {
      header: "Assigned To",
      accessor: (row: any) => {
        const assignedEmployees = (row.employeeIds || [])
          .map((id: string) => employees.find((e) => e.id === id))
          .filter(Boolean);
        
        if (assignedEmployees.length === 0) return "-";
        
        return (
          <div className="flex flex-wrap gap-1">
            {assignedEmployees.map((emp: any) => (
              <Badge key={emp.id} variant="secondary" className="text-xs">
                {emp.position}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      header: "Actions",
      accessor: (row: Operation) => (
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Operaciones</h1>
          <p className="text-muted-foreground mt-2">Gestiona operaciones de carga y logística</p>
        </div>
        <Dialog open={isCreateOpen || !!editingOperation} onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingOperation(null);
            setSelectedEmployeeIds([]);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-operation">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Operación
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingOperation ? "Editar Operación" : "Crear Operación"}</DialogTitle>
              <DialogDescription>
                {editingOperation ? "Actualiza los detalles de la operación" : "Agrega una nueva operación"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="details">Project Details</TabsTrigger>
                    <TabsTrigger value="shipping">Shipping Info</TabsTrigger>
                    <TabsTrigger value="tracking">Tracking & Dates</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="details" className="space-y-4 mt-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Name *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-name" placeholder="Enter project name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="clientId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Client *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || undefined}>
                              <FormControl>
                                <SelectTrigger data-testid="select-client">
                                  <SelectValue placeholder="Select client" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {clients.map((client) => (
                                  <SelectItem key={client.id} value={client.id}>
                                    {client.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="projectCategory"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project Category *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-project-category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="import">Import</SelectItem>
                                <SelectItem value="export">Export</SelectItem>
                                <SelectItem value="domestic">Domestic</SelectItem>
                                <SelectItem value="warehousing">Warehousing</SelectItem>
                                <SelectItem value="customs-clearance">Customs Clearance</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-status">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="planning">Planning</SelectItem>
                                <SelectItem value="in-progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date *</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} value={(field.value as unknown as string) || ""} data-testid="input-start-date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Deadline</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={(field.value as unknown as string) || ""} data-testid="input-end-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="operationType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Operation Type *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-operation-type">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="FCL">FCL (Full Container Load)</SelectItem>
                                <SelectItem value="LCL">LCL (Less Container Load)</SelectItem>
                                <SelectItem value="Air">Air Freight</SelectItem>
                                <SelectItem value="Road">Road Transport</SelectItem>
                                <SelectItem value="Rail">Rail Freight</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="shippingMode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Shipping Mode *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-shipping-mode">
                                  <SelectValue placeholder="Select mode" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="sea">Sea</SelectItem>
                                <SelectItem value="air">Air</SelectItem>
                                <SelectItem value="land">Land</SelectItem>
                                <SelectItem value="multimodal">Multimodal</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="insurance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Insurance *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-insurance">
                                  <SelectValue placeholder="Select insurance" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="projectCurrency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project Currency *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-currency">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="GBP">GBP</SelectItem>
                                <SelectItem value="MXN">MXN</SelectItem>
                                <SelectItem value="CAD">CAD</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Assigned To</label>
                      <EmployeeMultiSelect
                        employees={employees}
                        selectedIds={selectedEmployeeIds}
                        onChange={setSelectedEmployeeIds}
                        placeholder="Select employees..."
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="shipping" className="space-y-4 mt-4">
                    <FormField
                      control={form.control}
                      name="courier"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Courier</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} data-testid="input-courier" placeholder="e.g., DHL, FedEx, Maersk" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="pickUpAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pick Up Address</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} data-testid="input-pickup-address" placeholder="Enter pick up address" rows={3} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="deliveryAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Address</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} data-testid="input-delivery-address" placeholder="Enter delivery address" rows={3} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                  
                  <TabsContent value="tracking" className="space-y-4 mt-4">
                    <FormField
                      control={form.control}
                      name="bookingTracking"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Booking / Shipment Tracking</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} data-testid="input-booking-tracking" placeholder="Enter booking or tracking number" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="pickUpDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pick Up Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={(field.value as unknown as string) || ""} data-testid="input-pickup-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="etd"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ETD (Estimated Time of Departure)</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} value={(field.value as unknown as string) || ""} data-testid="input-etd" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="eta"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ETA (Estimated Time of Arrival)</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} value={(field.value as unknown as string) || ""} data-testid="input-eta" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="mblAwb"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>MBL / AWB</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} data-testid="input-mbl-awb" placeholder="Master Bill of Lading / Air Waybill" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="hblAwb"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>HBL / AWB</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} data-testid="input-hbl-awb" placeholder="House Bill of Lading / Air Waybill" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
                
                <Separator className="my-4" />
                
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingOperation(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                    {editingOperation ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={operations}
        columns={columns}
        searchPlaceholder="Buscar operaciones..."
        isLoading={isLoading}
        emptyMessage="No se encontraron operaciones. Crea tu primera operación para comenzar."
      />
    </div>
  );
}
