
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeMultiSelect } from "@/components/employee-multi-select";
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
import { insertOperationSchema, type Client, type Employee } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { z } from "zod";

// Fix leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

type OperationFormData = z.infer<typeof insertOperationSchema>;

interface LocationSuggestion {
  display_name: string;
  lat: string;
  lon: string;
}

function AddressAutocomplete({ 
  value, 
  onChange, 
  placeholder,
  onLocationSelect 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  placeholder: string;
  onLocationSelect?: (lat: number, lon: number) => void;
}) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (value.length < 3) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=1&extratags=1`
        );
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value]);

  const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
    onChange(suggestion.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    if (onLocationSelect) {
      onLocationSelect(parseFloat(suggestion.lat), parseFloat(suggestion.lon));
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="pl-10"
        />
      </div>
      {isLoading && (
        <div className="absolute top-full mt-1 w-full bg-popover border border-border rounded-md p-2 text-sm text-muted-foreground z-50">
          Buscando direcciones...
        </div>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full text-left px-4 py-2 hover:bg-accent text-sm border-b border-border last:border-b-0 transition-colors"
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <span>{suggestion.display_name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function OperationsCreatePage() {
  const [, setLocation] = useLocation();
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [pickupLocation, setPickupLocation] = useState<[number, number] | null>(null);
  const [deliveryLocation, setDeliveryLocation] = useState<[number, number] | null>(null);
  const { toast } = useToast();

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
      toast({ title: "Operation created successfully" });
      setLocation("/operations");
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

    createMutation.mutate(formattedData);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/operations")}
          className="shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Nueva Operación</h1>
          <p className="text-muted-foreground mt-1">Crea una nueva operación de carga y logística</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Detalles del Proyecto</TabsTrigger>
              <TabsTrigger value="shipping">Información de Envío</TabsTrigger>
              <TabsTrigger value="tracking">Rastreo y Fechas</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información General</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Proyecto *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-name" placeholder="Ingrese el nombre del proyecto" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={field.value || ""} placeholder="Descripción detallada de la operación" rows={4} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cliente y Categoría</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cliente *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger data-testid="select-client">
                                <SelectValue placeholder="Seleccionar cliente" />
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
                          <FormLabel>Categoría del Proyecto *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-project-category">
                                <SelectValue placeholder="Seleccionar categoría" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="import">Importación</SelectItem>
                              <SelectItem value="export">Exportación</SelectItem>
                              <SelectItem value="domestic">Nacional</SelectItem>
                              <SelectItem value="warehousing">Almacenamiento</SelectItem>
                              <SelectItem value="customs-clearance">Despacho Aduanal</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Estado y Fechas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="planning">Planificación</SelectItem>
                              <SelectItem value="in-progress">En Progreso</SelectItem>
                              <SelectItem value="completed">Completado</SelectItem>
                              <SelectItem value="cancelled">Cancelado</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prioridad *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Baja</SelectItem>
                              <SelectItem value="medium">Media</SelectItem>
                              <SelectItem value="high">Alta</SelectItem>
                              <SelectItem value="urgent">Urgente</SelectItem>
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
                          <FormLabel>Moneda del Proyecto *</FormLabel>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de Inicio *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={(field.value as unknown as string) || ""} data-testid="input-start-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha Límite</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={(field.value as unknown as string) || ""} data-testid="input-end-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tipo de Operación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="operationType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Operación *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-operation-type">
                                <SelectValue placeholder="Seleccionar tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="FCL">FCL (Full Container Load)</SelectItem>
                              <SelectItem value="LCL">LCL (Less Container Load)</SelectItem>
                              <SelectItem value="Air">Carga Aérea</SelectItem>
                              <SelectItem value="Road">Transporte Terrestre</SelectItem>
                              <SelectItem value="Rail">Transporte Ferroviario</SelectItem>
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
                          <FormLabel>Modo de Envío *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-shipping-mode">
                                <SelectValue placeholder="Seleccionar modo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="sea">Marítimo</SelectItem>
                              <SelectItem value="air">Aéreo</SelectItem>
                              <SelectItem value="land">Terrestre</SelectItem>
                              <SelectItem value="multimodal">Multimodal</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="insurance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Seguro *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-insurance">
                                <SelectValue placeholder="Seleccionar seguro" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="yes">Sí</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Asignación de Personal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Empleados Asignados</label>
                    <EmployeeMultiSelect
                      employees={employees}
                      selectedIds={selectedEmployeeIds}
                      onChange={setSelectedEmployeeIds}
                      placeholder="Seleccionar empleados..."
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="shipping" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Información del Courier</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="courier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Courier</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-courier" placeholder="ej., DHL, FedEx, Maersk" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Direcciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="pickUpAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección de Recogida</FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder="Buscar dirección de recogida..."
                            onLocationSelect={(lat, lon) => setPickupLocation([lat, lon])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {pickupLocation && (
                    <div className="h-[250px] rounded-lg overflow-hidden border border-border">
                      <MapContainer
                        center={pickupLocation}
                        zoom={15}
                        style={{ height: "100%", width: "100%" }}
                        className="z-0"
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        />
                        <Marker position={pickupLocation} />
                      </MapContainer>
                    </div>
                  )}
                  
                  <FormField
                    control={form.control}
                    name="deliveryAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección de Entrega</FormLabel>
                        <FormControl>
                          <AddressAutocomplete
                            value={field.value || ""}
                            onChange={field.onChange}
                            placeholder="Buscar dirección de entrega..."
                            onLocationSelect={(lat, lon) => setDeliveryLocation([lat, lon])}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {deliveryLocation && (
                    <div className="h-[250px] rounded-lg overflow-hidden border border-border">
                      <MapContainer
                        center={deliveryLocation}
                        zoom={15}
                        style={{ height: "100%", width: "100%" }}
                        className="z-0"
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        />
                        <Marker position={deliveryLocation} />
                      </MapContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="tracking" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Número de Rastreo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="bookingTracking"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Booking / Número de Rastreo</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} data-testid="input-booking-tracking" placeholder="Ingrese número de booking o rastreo" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Fechas Importantes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="pickUpDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Recogida</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={(field.value as unknown as string) || ""} data-testid="input-pickup-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="etd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ETD (Fecha Estimada de Salida)</FormLabel>
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
                          <FormLabel>ETA (Fecha Estimada de Llegada)</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={(field.value as unknown as string) || ""} data-testid="input-eta" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Documentación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          <Separator />
          
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/operations")}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
              {createMutation.isPending ? "Creando..." : "Crear Operación"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
