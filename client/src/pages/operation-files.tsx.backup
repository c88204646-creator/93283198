import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ObjectUploader } from "@/components/ObjectUploader";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  FileText,
  Folder,
  MoreVertical,
  Upload,
  FolderPlus,
  Download,
  Trash,
  Edit,
  Image,
  FileArchive,
  FileSpreadsheet,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { OperationFile, OperationFolder } from "@shared/schema";

const FILE_CATEGORIES = [
  { value: "payment", label: "Pago", icon: "💰" },
  { value: "expense", label: "Gasto", icon: "💸" },
  { value: "image", label: "Imagen", icon: "🖼️" },
  { value: "document", label: "Documento", icon: "📄" },
  { value: "contract", label: "Contrato", icon: "📋" },
  { value: "invoice", label: "Factura", icon: "🧾" },
  { value: "other", label: "Otro", icon: "📎" },
];

const FOLDER_COLORS = [
  { value: "blue", label: "Azul", class: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" },
  { value: "green", label: "Verde", class: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300" },
  { value: "yellow", label: "Amarillo", class: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300" },
  { value: "red", label: "Rojo", class: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300" },
  { value: "purple", label: "Púrpura", class: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300" },
  { value: "gray", label: "Gris", class: "bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300" },
];

function getFileIcon(mimeType: string, category: string | null) {
  if (category === "image" || mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("pdf")) return FileText;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  if (mimeType.includes("zip") || mimeType.includes("rar")) return FileArchive;
  return FileText;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

export default function OperationFilesPage() {
  const { operationId } = useParams<{ operationId: string }>();
  const { toast } = useToast();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<OperationFolder | null>(null);
  const [editingFile, setEditingFile] = useState<OperationFile | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ fileURL: string; file: any } | null>(null);
  const [previewFile, setPreviewFile] = useState<OperationFile | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(0);

  const { data: folders = [] } = useQuery<OperationFolder[]>({
    queryKey: ["/api/operations", operationId, "folders"],
  });

  const { data: files = [] } = useQuery<OperationFile[]>({
    queryKey: ["/api/operations", operationId, "files"],
    queryFn: () =>
      fetch(`/api/operations/${operationId}/files?folderId=${selectedFolder || 'null'}`)
        .then((res) => res.json()),
  });

  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; category?: string; color?: string }) => {
      return apiRequest(`/api/operations/${operationId}/folders`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "folders"] });
      setIsFolderDialogOpen(false);
      setEditingFolder(null);
      toast({ title: "Carpeta creada exitosamente" });
    },
    onError: (error: any) => {
      console.error("Error creating folder:", error);
      toast({ 
        title: "Error al crear carpeta", 
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive" 
      });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; description?: string; category?: string; color?: string }) => {
      return apiRequest(`/api/operations/${operationId}/folders/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "folders"] });
      setIsFolderDialogOpen(false);
      setEditingFolder(null);
      toast({ title: "Carpeta actualizada" });
    },
    onError: (error: any) => {
      console.error("Error updating folder:", error);
      toast({ 
        title: "Error al actualizar carpeta", 
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive" 
      });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/operations/${operationId}/folders/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "folders"] });
      toast({ title: "Carpeta eliminada" });
    },
    onError: (error: any) => {
      console.error("Error deleting folder:", error);
      toast({ 
        title: "Error al eliminar carpeta", 
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive" 
      });
    },
  });

  const createFileMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/operations/${operationId}/files`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      setPendingUpload(null);
      setIsFileDialogOpen(false);
      setIsUploadOpen(false);
      toast({ title: "Archivo subido exitosamente" });
    },
    onError: (error: any) => {
      console.error("Error creating file:", error);
      toast({ 
        title: "Error al subir archivo", 
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive" 
      });
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return apiRequest(`/api/operations/${operationId}/files/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      setIsFileDialogOpen(false);
      setEditingFile(null);
      toast({ title: "Archivo actualizado" });
    },
    onError: (error: any) => {
      console.error("Error updating file:", error);
      toast({ 
        title: "Error al actualizar archivo", 
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive" 
      });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/operations/${operationId}/files/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      toast({ title: "Archivo eliminado" });
    },
    onError: (error: any) => {
      console.error("Error deleting file:", error);
      toast({ 
        title: "Error al eliminar archivo", 
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive" 
      });
    },
  });

  const handleUploadComplete = (fileURL: string, file: any) => {
    setPendingUpload({ fileURL, file });
    setIsFileDialogOpen(true);
  };

  const handleSaveFile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const tagsValue = formData.get("tags")?.toString().trim();
    const tags = tagsValue ? tagsValue.split(",").map(t => t.trim()).filter(Boolean) : null;
    const finalTags = tags && tags.length > 0 ? tags : null;

    if (editingFile) {
      updateFileMutation.mutate({
        id: editingFile.id,
        name: formData.get("name") as string,
        description: formData.get("description") as string || null,
        category: formData.get("category") as string || null,
        tags: finalTags,
        folderId: formData.get("folderId") as string || null,
      });
    } else if (pendingUpload) {
      createFileMutation.mutate({
        fileURL: pendingUpload.fileURL,
        originalName: pendingUpload.file.name,
        mimeType: pendingUpload.file.type || "application/octet-stream",
        size: pendingUpload.file.size,
        folderId: formData.get("folderId") as string || null,
        category: formData.get("category") as string || null,
        description: formData.get("description") as string || null,
        tags: finalTags,
      });
    }
  };

  const handleSaveFolder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string || null,
      category: formData.get("category") as string || null,
      color: formData.get("color") as string || null,
    };

    if (editingFolder) {
      updateFolderMutation.mutate({ id: editingFolder.id, ...data });
    } else {
      createFolderMutation.mutate(data);
    }
  };

  const handlePreview = (file: OperationFile) => {
    const index = files.findIndex(f => f.id === file.id);
    setPreviewIndex(index);
    setPreviewFile(file);
  };

  const handlePrevFile = () => {
    if (previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
      setPreviewFile(files[previewIndex - 1]);
    }
  };

  const handleNextFile = () => {
    if (previewIndex < files.length - 1) {
      setPreviewIndex(previewIndex + 1);
      setPreviewFile(files[previewIndex + 1]);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Archivos</h1>
          <p className="text-muted-foreground">Organiza y gestiona todos los archivos de la operación</p>
        </div>
        <div className="flex gap-2">
          <Button
            data-testid="button-new-folder"
            variant="outline"
            onClick={() => {
              setEditingFolder(null);
              setIsFolderDialogOpen(true);
            }}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Nueva Carpeta
          </Button>
          <Button
            data-testid="button-upload-file"
            onClick={() => setIsUploadOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Subir Archivo
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Carpetas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              data-testid="folder-all"
              variant={selectedFolder === null ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSelectedFolder(null)}
            >
              <Folder className="w-4 h-4 mr-2" />
              Todos los archivos
            </Button>
            {folders.map((folder) => {
              const colorClass = FOLDER_COLORS.find(c => c.value === folder.color)?.class || FOLDER_COLORS[0].class;
              return (
                <div key={folder.id} className="flex items-center gap-2">
                  <Button
                    data-testid={`folder-${folder.id}`}
                    variant={selectedFolder === folder.id ? "default" : "ghost"}
                    className="flex-1 justify-start"
                    onClick={() => setSelectedFolder(folder.id)}
                  >
                    <Folder className={`w-4 h-4 mr-2 ${colorClass.split(" ")[2]}`} />
                    {folder.name}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`folder-menu-${folder.id}`}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        data-testid={`folder-edit-${folder.id}`}
                        onClick={() => {
                          setEditingFolder(folder);
                          setIsFolderDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        data-testid={`folder-delete-${folder.id}`}
                        onClick={() => {
                          if (confirm("¿Eliminar esta carpeta?")) {
                            deleteFolderMutation.mutate(folder.id);
                          }
                        }}
                        className="text-destructive"
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedFolder
                  ? folders.find(f => f.id === selectedFolder)?.name || "Archivos"
                  : "Todos los archivos"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay archivos en esta carpeta</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {files.map((file) => {
                    const FileIcon = getFileIcon(file.mimeType, file.category);
                    const category = FILE_CATEGORIES.find(c => c.value === file.category);
                    const isImage = file.mimeType.startsWith("image/") || file.category === "image";

                    return (
                      <Card 
                        key={file.id} 
                        className="hover-elevate cursor-pointer overflow-hidden"
                        onClick={() => handlePreview(file)}
                        data-testid={`file-card-${file.id}`}
                      >
                        <CardContent className="p-0">
                          {isImage ? (
                            <div className="relative w-full h-48 bg-muted overflow-hidden">
                              <img 
                                src={file.objectPath} 
                                alt={file.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute top-2 right-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="secondary" size="icon" data-testid={`file-menu-${file.id}`}>
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem
                                      data-testid={`file-download-${file.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const a = document.createElement("a");
                                        a.href = file.objectPath;
                                        a.download = file.originalName;
                                        a.click();
                                      }}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      Descargar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      data-testid={`file-edit-${file.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingFile(file);
                                        setIsFileDialogOpen(true);
                                      }}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      data-testid={`file-delete-${file.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm("¿Eliminar este archivo?")) {
                                          deleteFileMutation.mutate(file.id);
                                        }
                                      }}
                                      className="text-destructive"
                                    >
                                      <Trash className="w-4 h-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-32 bg-muted">
                              <FileIcon className="w-16 h-16 text-primary opacity-50" />
                            </div>
                          )}
                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-medium truncate flex-1" data-testid={`file-name-${file.id}`}>
                                {file.name}
                              </h3>
                              {!isImage && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" data-testid={`file-menu-${file.id}`}>
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem
                                      data-testid={`file-download-${file.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const a = document.createElement("a");
                                        a.href = file.objectPath;
                                        a.download = file.originalName;
                                        a.click();
                                      }}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      Descargar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      data-testid={`file-edit-${file.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingFile(file);
                                        setIsFileDialogOpen(true);
                                      }}
                                    >
                                      <Edit className="w-4 h-4 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      data-testid={`file-delete-${file.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm("¿Eliminar este archivo?")) {
                                          deleteFileMutation.mutate(file.id);
                                        }
                                      }}
                                      className="text-destructive"
                                    >
                                      <Trash className="w-4 h-4 mr-2" />
                                      Eliminar
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              {formatFileSize(file.size)}
                            </p>
                            {category && (
                              <Badge variant="secondary" className="text-xs mb-2">
                                {category.icon} {category.label}
                              </Badge>
                            )}
                            {file.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {file.description}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ObjectUploader
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={handleUploadComplete}
      />

      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent data-testid="dialog-folder">
          <form onSubmit={handleSaveFolder}>
            <DialogHeader>
              <DialogTitle>{editingFolder ? "Editar Carpeta" : "Nueva Carpeta"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  name="name"
                  data-testid="input-folder-name"
                  defaultValue={editingFolder?.name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  name="description"
                  data-testid="input-folder-description"
                  defaultValue={editingFolder?.description || ""}
                />
              </div>
              <div>
                <Label htmlFor="category">Categoría</Label>
                <Select name="category" defaultValue={editingFolder?.category || undefined}>
                  <SelectTrigger data-testid="select-folder-category">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <Select name="color" defaultValue={editingFolder?.color || "blue"}>
                  <SelectTrigger data-testid="select-folder-color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLDER_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        {color.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsFolderDialogOpen(false);
                  setEditingFolder(null);
                }}
                data-testid="button-cancel-folder"
              >
                Cancelar
              </Button>
              <Button type="submit" data-testid="button-save-folder">
                {editingFolder ? "Actualizar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
        <DialogContent data-testid="dialog-file">
          <form onSubmit={handleSaveFile}>
            <DialogHeader>
              <DialogTitle>{editingFile ? "Editar Archivo" : "Detalles del Archivo"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="file-name">Nombre</Label>
                <Input
                  id="file-name"
                  name="name"
                  data-testid="input-file-name"
                  defaultValue={editingFile?.name || pendingUpload?.file.name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="file-folder">Carpeta</Label>
                <Select name="folderId" defaultValue={editingFile?.folderId || selectedFolder || undefined}>
                  <SelectTrigger data-testid="select-file-folder">
                    <SelectValue placeholder="Sin carpeta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin carpeta</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="file-category">Categoría</Label>
                <Select name="category" defaultValue={editingFile?.category || undefined}>
                  <SelectTrigger data-testid="select-file-category">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="file-description">Descripción</Label>
                <Textarea
                  id="file-description"
                  name="description"
                  data-testid="input-file-description"
                  defaultValue={editingFile?.description || ""}
                />
              </div>
              <div>
                <Label htmlFor="file-tags">Etiquetas (separadas por comas)</Label>
                <Input
                  id="file-tags"
                  name="tags"
                  data-testid="input-file-tags"
                  defaultValue={editingFile?.tags?.join(", ") || ""}
                  placeholder="ej: importante, urgente"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsFileDialogOpen(false);
                  setEditingFile(null);
                  setPendingUpload(null);
                }}
                data-testid="button-cancel-file"
              >
                Cancelar
              </Button>
              <Button type="submit" data-testid="button-save-file">
                {editingFile ? "Actualizar" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-5xl h-[90vh] p-0" data-testid="dialog-preview">
          {previewFile && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate" data-testid="preview-file-name">{previewFile.name}</h3>
                  <p className="text-sm text-muted-foreground">{formatFileSize(previewFile.size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrevFile}
                    disabled={previewIndex === 0}
                    data-testid="button-prev-file"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    {previewIndex + 1} / {files.length}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextFile}
                    disabled={previewIndex === files.length - 1}
                    data-testid="button-next-file"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = previewFile.objectPath;
                      a.download = previewFile.originalName;
                      a.click();
                    }}
                    data-testid="button-download-preview"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPreviewFile(null)}
                    data-testid="button-close-preview"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-4">
                {previewFile.mimeType.startsWith("image/") || previewFile.category === "image" ? (
                  <img 
                    src={previewFile.objectPath} 
                    alt={previewFile.name}
                    className="max-w-full max-h-full object-contain"
                    data-testid="preview-image"
                  />
                ) : previewFile.mimeType === "application/pdf" ? (
                  <iframe
                    src={previewFile.objectPath}
                    className="w-full h-full border-0"
                    title={previewFile.name}
                    data-testid="preview-pdf"
                  />
                ) : (
                  <div className="text-center">
                    <FileText className="w-24 h-24 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-4">
                      No se puede previsualizar este tipo de archivo
                    </p>
                    <Button
                      onClick={() => window.open(previewFile.objectPath, "_blank")}
                      data-testid="button-open-new-tab"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Abrir en nueva pestaña
                    </Button>
                  </div>
                )}
              </div>
              {previewFile.description && (
                <div className="p-4 border-t bg-background">
                  <h4 className="font-medium mb-1">Descripción</h4>
                  <p className="text-sm text-muted-foreground">{previewFile.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
