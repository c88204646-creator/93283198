import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { FileUploader } from "@/components/FileUploader";
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
  { value: "payment", label: "Payment", icon: "💰" },
  { value: "expense", label: "Expense", icon: "💸" },
  { value: "image", label: "Image", icon: "🖼️" },
  { value: "document", label: "Document", icon: "📄" },
  { value: "contract", label: "Contract", icon: "📋" },
  { value: "invoice", label: "Invoice", icon: "🧾" },
  { value: "other", label: "Other", icon: "📎" },
];

const FOLDER_COLORS = [
  { value: "blue", label: "Blue", class: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300" },
  { value: "green", label: "Green", class: "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300" },
  { value: "yellow", label: "Yellow", class: "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300" },
  { value: "red", label: "Red", class: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300" },
  { value: "purple", label: "Purple", class: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300" },
  { value: "gray", label: "Gray", class: "bg-gray-100 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300" },
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
  const [pendingUpload, setPendingUpload] = useState<{ b2Key: string; fileHash: string; size: number; originalName: string; mimeType: string } | null>(null);
  const [previewFile, setPreviewFile] = useState<OperationFile | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(0);

  const { data: folders = [] } = useQuery<OperationFolder[]>({
    queryKey: ["/api/operations", operationId, "folders"],
  });

  const { data: files = [] } = useQuery<OperationFile[]>({
    queryKey: ["/api/operations", operationId, "files", selectedFolder],
    queryFn: () => {
      const url = selectedFolder === null 
        ? `/api/operations/${operationId}/files`
        : `/api/operations/${operationId}/files?folderId=${selectedFolder}`;
      return fetch(url).then((res) => res.json());
    },
  });

  // Simple folder creation without complex state
  const createFolderMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const data = {
        name: formData.get("name") as string,
        description: formData.get("description") as string || null,
        category: formData.get("category") as string || null,
        color: formData.get("color") as string || "blue",
      };
      return apiRequest(`/api/operations/${operationId}/folders`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "folders"] });
      setIsFolderDialogOpen(false);
      setEditingFolder(null);
      toast({ title: "Folder created successfully" });
    },
    onError: (error: any) => {
      console.error("Error creating folder:", error);
      toast({ 
        title: "Error creating folder", 
        description: error.message || "An unexpected error occurred",
        variant: "destructive" 
      });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: FormData }) => {
      const data = {
        name: formData.get("name") as string,
        description: formData.get("description") as string || null,
        category: formData.get("category") as string || null,
        color: formData.get("color") as string || "blue",
      };
      return apiRequest(`/api/operations/${operationId}/folders/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "folders"] });
      setIsFolderDialogOpen(false);
      setEditingFolder(null);
      toast({ title: "Folder updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating folder", description: error.message, variant: "destructive" });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/operations/${operationId}/folders/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "folders"] });
      toast({ title: "Folder deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting folder", description: error.message, variant: "destructive" });
    },
  });

  const createFileMutation = useMutation({
    mutationFn: async (data: any) => apiRequest(`/api/operations/${operationId}/files`, "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      setPendingUpload(null);
      setIsFileDialogOpen(false);
      setIsUploadOpen(false);
      toast({ title: "File uploaded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error uploading file", description: error.message, variant: "destructive" });
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest(`/api/operations/${operationId}/files/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      setIsFileDialogOpen(false);
      setEditingFile(null);
      toast({ title: "File updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating file", description: error.message, variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/operations/${operationId}/files/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations", operationId, "files"] });
      toast({ title: "File deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting file", description: error.message, variant: "destructive" });
    },
  });

  const handleUploadComplete = (result: { b2Key: string; fileHash: string; size: number; originalName: string; mimeType: string }) => {
    setPendingUpload(result);
    setIsFileDialogOpen(true);
  };

  const handleSaveFolder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (editingFolder) {
      updateFolderMutation.mutate({ id: editingFolder.id, formData });
    } else {
      createFolderMutation.mutate(formData);
    }
  };

  const handleSaveFile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const tagsValue = formData.get("tags")?.toString().trim();
    const tags = tagsValue ? tagsValue.split(",").map(t => t.trim()).filter(Boolean) : null;

    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string || null,
      category: formData.get("category") as string || null,
      folderId: formData.get("folderId") as string || null,
      tags: tags && tags.length > 0 ? tags : null,
    };

    if (editingFile) {
      updateFileMutation.mutate({ id: editingFile.id, data });
    } else if (pendingUpload) {
      createFileMutation.mutate({
        ...data,
        b2Key: pendingUpload.b2Key,
        fileHash: pendingUpload.fileHash,
        originalName: pendingUpload.originalName,
        mimeType: pendingUpload.mimeType,
        size: pendingUpload.size,
      });
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
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Files</h1>
        <div className="flex gap-2">
          <Button onClick={() => setIsUploadOpen(true)} data-testid="button-upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload File
          </Button>
          <Button onClick={() => {
            setEditingFolder(null);
            setIsFolderDialogOpen(true);
          }} variant="outline" data-testid="button-new-folder">
            <FolderPlus className="w-4 h-4 mr-2" />
            New Folder
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Folders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              data-testid="folder-all"
              variant={selectedFolder === null ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setSelectedFolder(null)}
            >
              <Folder className="w-4 h-4 mr-2" />
              All Files
            </Button>
            {folders.map((folder) => {
              const folderColor = FOLDER_COLORS.find(c => c.value === folder.color) || FOLDER_COLORS[0];
              const isSelected = selectedFolder === folder.id;

              return (
                <div
                  key={folder.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${isSelected ? folderColor.class : "hover:bg-accent"} cursor-pointer`}
                  onClick={() => setSelectedFolder(folder.id)}
                  data-testid={`folder-${folder.id}`}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <Folder className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate text-sm font-medium">{folder.name}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
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
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        data-testid={`folder-delete-${folder.id}`}
                        onClick={() => {
                          if (confirm("Delete this folder?")) {
                            deleteFolderMutation.mutate(folder.id);
                          }
                        }}
                        className="text-destructive"
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Delete
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
                  ? folders.find(f => f.id === selectedFolder)?.name || "Files"
                  : "All Files"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {files.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No files in this folder</p>
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
                                src={`/api/operations/${operationId}/files/${file.id}/download`}
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
                                        window.open(`/api/operations/${operationId}/files/${file.id}/download`, "_blank");
                                      }}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      Download
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
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      data-testid={`file-delete-${file.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm("Delete this file?")) {
                                          deleteFileMutation.mutate(file.id);
                                        }
                                      }}
                                      className="text-destructive"
                                    >
                                      <Trash className="w-4 h-4 mr-2" />
                                      Delete
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
                                        window.open(`/api/operations/${operationId}/files/${file.id}/download`, "_blank");
                                      }}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      Download
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
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      data-testid={`file-delete-${file.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm("Delete this file?")) {
                                          deleteFileMutation.mutate(file.id);
                                        }
                                      }}
                                      className="text-destructive"
                                    >
                                      <Trash className="w-4 h-4 mr-2" />
                                      Delete
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

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent data-testid="dialog-upload">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>Upload a file to this operation</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <FileUploader
              operationId={operationId!}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Folder Dialog */}
      <Dialog open={isFolderDialogOpen} onOpenChange={(open) => {
        setIsFolderDialogOpen(open);
        if (!open) setEditingFolder(null);
      }}>
        <DialogContent data-testid="dialog-folder">
          <form onSubmit={handleSaveFolder}>
            <DialogHeader>
              <DialogTitle>{editingFolder ? "Edit Folder" : "New Folder"}</DialogTitle>
              <DialogDescription>
                {editingFolder ? "Update folder details" : "Create a new folder for organizing files"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  name="name"
                  data-testid="input-folder-name"
                  defaultValue={editingFolder?.name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  data-testid="input-folder-description"
                  defaultValue={editingFolder?.description || ""}
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  name="category"
                  defaultValue={editingFolder?.category || ""}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  data-testid="select-folder-category"
                >
                  <option value="">Select category</option>
                  {FILE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <select
                  id="color"
                  name="color"
                  defaultValue={editingFolder?.color || "blue"}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  data-testid="select-folder-color"
                >
                  {FOLDER_COLORS.map((color) => (
                    <option key={color.value} value={color.value}>
                      {color.label}
                    </option>
                  ))}
                </select>
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
                Cancel
              </Button>
              <Button 
                type="submit" 
                data-testid="button-save-folder"
                disabled={createFolderMutation.isPending || updateFolderMutation.isPending}
              >
                {editingFolder ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* File Dialog */}
      <Dialog open={isFileDialogOpen} onOpenChange={(open) => {
        setIsFileDialogOpen(open);
        if (!open) {
          setEditingFile(null);
          setPendingUpload(null);
        }
      }}>
        <DialogContent data-testid="dialog-file">
          <form onSubmit={handleSaveFile}>
            <DialogHeader>
              <DialogTitle>{editingFile ? "Edit File" : "File Details"}</DialogTitle>
              <DialogDescription>
                {editingFile ? "Update file information" : "Add file details before saving"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="file-name">Name *</Label>
                <Input
                  id="file-name"
                  name="name"
                  data-testid="input-file-name"
                  defaultValue={editingFile?.name || pendingUpload?.originalName}
                  required
                />
              </div>
              <div>
                <Label htmlFor="file-folder">Folder</Label>
                <select
                  id="file-folder"
                  name="folderId"
                  defaultValue={editingFile?.folderId || selectedFolder || ""}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  data-testid="select-file-folder"
                >
                  <option value="">No folder</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="file-category">Category</Label>
                <select
                  id="file-category"
                  name="category"
                  defaultValue={editingFile?.category || ""}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  data-testid="select-file-category"
                >
                  <option value="">Select category</option>
                  {FILE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="file-description">Description</Label>
                <Textarea
                  id="file-description"
                  name="description"
                  data-testid="input-file-description"
                  defaultValue={editingFile?.description || ""}
                />
              </div>
              <div>
                <Label htmlFor="file-tags">Tags (comma-separated)</Label>
                <Input
                  id="file-tags"
                  name="tags"
                  data-testid="input-file-tags"
                  defaultValue={editingFile?.tags?.join(", ") || ""}
                  placeholder="e.g.: important, urgent"
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
                Cancel
              </Button>
              <Button 
                type="submit" 
                data-testid="button-save-file"
                disabled={createFileMutation.isPending || updateFileMutation.isPending}
              >
                {editingFile ? "Update" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
