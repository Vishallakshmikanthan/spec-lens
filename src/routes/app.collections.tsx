import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { FolderOpen, Plus, Edit, X, Check, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockCollections, mockEvidence } from "@/lib/speclens/mock-data";
import type { Collection, Evidence } from "@/types/speclens";
import { PageHeader, DemoNotice } from "@/components/speclens/primitives";
import {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/collections")({
  head: () => ({
    meta: [
      { title: "Collections — SpecLens" },
      {
        name: "description",
        content: "Organize verified evidence, datasheets and components into research collections.",
      },
      { property: "og:title", content: "Collections — SpecLens" },
      {
        property: "og:description",
        content: "Organize verified evidence, datasheets and components into research collections.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>(mockCollections);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [newCollection, setNewCollection] = useState({
    name: "",
    description: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [addEvidenceTarget, setAddEvidenceTarget] = useState<{
    collection: Collection;
    evidence: Evidence;
  } | null>(null);
  const [removeEvidenceTarget, setRemoveEvidenceTarget] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "rename";
    collection: Collection;
  } | null>(null);

  // Derive evidence count from collections' evidence tracking
  const getEvidenceCount = (col: Collection): number => {
    // In a real app, this would query the backend.
    // For mock, we track evidenceIds inline via data attribute.
    // Fall back to the stored count.
    return col.evidence;
  };

  // Handle adding evidence to a collection
  const handleAddEvidence = useCallback(
    (ev: Evidence) => {
      const found = collections.find((c) => c.id === ev.id);
      setAddEvidenceTarget({
        collection:
          found ||
          ({
            id: "",
            name: "",
            description: "",
            datasheets: 0,
            evidence: 0,
            components: 0,
          } as Collection),
        evidence: ev,
      });
    },
    [collections],
  );

  const [openDrawer, setOpenDrawer] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("New collection");
  const [drawerSubmit, setDrawerSubmit] = useState<() => void>(() => {});

  const openNewCollectionDrawer = () => {
    setNewCollection({ name: "", description: "" });
    setDrawerTitle("New collection");
    setOpenDrawer(true);
  };

  const closeDrawer = () => {
    setOpenDrawer(false);
    setEditingCollection(null);
  };

  const handleDrawerSubmit = useCallback(() => {
    if (!newCollection.name.trim()) return;
    const id = `col_${String(collections.length + 1).padStart(3, "0")}`;
    const collection: Collection = {
      id,
      name: newCollection.name,
      description: newCollection.description || "",
      datasheets: 0,
      evidence: 0,
      components: 0,
      updatedAt: new Date().toISOString(),
    };
    setCollections((prev) => [...prev, collection]);
    setShowNewCollection(false);
    setOpenDrawer(false);
    toast("Collection created — " + newCollection.name + " has been added.");
  }, [newCollection, setCollections, toast]);

  // Rename collection
  const openRenameDrawer = (col: Collection) => {
    setNewCollection({ name: col.name, description: col.description });
    setEditingCollection(col);
    setDrawerTitle("Rename collection");
    setOpenDrawer(true);
  };

  const handleRenameSubmit = useCallback(() => {
    if (!newCollection.name.trim() || !editingCollection) return;
    setCollections((prev) =>
      prev.map((c) =>
        c.id === editingCollection.id
          ? {
              ...c,
              name: newCollection.name,
              description: newCollection.description || "",
              updatedAt: new Date().toISOString(),
            }
          : c,
      ),
    );
    setEditingCollection(null);
    setOpenDrawer(false);
    toast("Collection renamed — " + newCollection.name);
  }, [newCollection, editingCollection, setCollections, toast]);

  // Delete collection
  const openDeleteConfirm = (col: Collection) => {
    setDeleteTarget(col);
    setConfirmAction({ type: "delete", collection: col });
  };

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    setCollections((prev) => prev.filter((c) => c.id !== deleteTarget!.id));
    setDeleteTarget(null);
    setConfirmAction(null);
    toast("Collection deleted — " + deleteTarget.name + " has been removed.");
  }, [deleteTarget, toast]);

  // Add evidence to collection - mock persistence
  const handleAddEvidenceConfirm = useCallback(() => {
    if (!addEvidenceTarget) return;
    const { collection, evidence } = addEvidenceTarget;
    // Add evidence ID to collection's tracking
    const updatedCollection: Collection = {
      ...collection,
      evidence: (collection.evidence ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    setCollections((prev) =>
      prev.map((c) => (c.id === updatedCollection.id ? updatedCollection : c)),
    );
    setAddEvidenceTarget(null);
    toast("Evidence added — " + evidence.title + " to " + collection.name);
  }, [addEvidenceTarget, setCollections, toast]);

  const handleRemoveEvidenceConfirm = useCallback(() => {
    if (!removeEvidenceTarget) return;
    const evidenceId = removeEvidenceTarget;
    setCollections((prev) =>
      prev.map((c) => {
        const newEvidenceCount = (c.evidence ?? 0) > 0 ? (c.evidence ?? 0) - 1 : 0;
        return { ...c, evidence: newEvidenceCount, updatedAt: new Date().toISOString() };
      }),
    );
    setRemoveEvidenceTarget(null);
    toast("Evidence removed from collection");
  }, [setCollections, toast]);

  return (
    <div>
      <PageHeader
        title="Collections"
        subtitle="Organize verified evidence beyond a single search."
        actions={
          <Button size="sm" onClick={openNewCollectionDrawer}>
            <Plus className="size-3.5 mr-2" /> New collection
          </Button>
        }
      />
      <div className="space-y-4 px-4 py-6 sm:px-6 xl:px-8">
        {/* New collection drawer */}
        <Drawer open={openDrawer} onOpenChange={setOpenDrawer}>
          <DrawerOverlay className="bg-black/40" />
          <DrawerContent className="sm:max-w-md">
            <DrawerHeader>
              <DrawerClose onClick={closeDrawer} />
              <DrawerTitle>{drawerTitle}</DrawerTitle>
              <DrawerDescription>
                {editingCollection
                  ? `Rename "${editingCollection.name}"`
                  : "Enter a name for your new collection"}
              </DrawerDescription>
            </DrawerHeader>

            <div className="space-y-4 p-4">
              <div>
                <label className="block text-[11px] font-medium mb-2 text-foreground">
                  Name
                  <span className="text-muted-foreground">*</span>
                </label>
                <input
                  value={newCollection.name}
                  onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                  placeholder="e.g. Motor Controller Research"
                  className="w-full rounded-border border-border px-3 py-2 focus:border-primary"
                />
              </div>
              {!editingCollection && (
                <div>
                  <label className="block text-[11px] font-medium mb-2 text-foreground">
                    Description
                    <span className="text-muted-foreground">optional</span>
                  </label>
                  <textarea
                    value={newCollection.description || ""}
                    onChange={(e) =>
                      setNewCollection({ ...newCollection, description: e.target.value })
                    }
                    rows={3}
                    placeholder="Brief description of the collection's focus"
                    className="w-full rounded-border border-border px-3 py-2 focus:border-primary resize-y"
                  />
                </div>
              )}
              <div className="space-y-2">
                {editingCollection && (
                  <button
                    onClick={() => {
                      setDrawerSubmit(handleRenameSubmit);
                      setDrawerTitle("Renaming collection...");
                    }}
                    className="w-full rounded-border border-secondary px-3 py-2 text-[11px] font-medium text-secondary hover:bg-secondary/10"
                  >
                    Rename
                  </button>
                )}
                <button
                  onClick={() => {
                    setDrawerSubmit(handleDrawerSubmit);
                    setDrawerTitle("New collection");
                  }}
                  className="w-full rounded-border border-primary px-3 py-2 text-[11px] font-medium text-primary hover:bg-primary/10"
                >
                  {editingCollection ? "Cancel" : "Create"}
                </button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>

        {/* Collections grid */}
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <li key={collection.id} className="panel p-4 flex flex-col h-100">
              <FolderOpen className="size-4 text-primary mb-3 flex-shrink-0" aria-hidden="true" />

              <h2 className="mt-2 text-[14px] font-medium flex-1">{collection.name}</h2>

              <p className="mt-1 text-[12.5px] text-muted-foreground flex-1 truncate">
                {collection.description}
              </p>

              <div className="mt-3 flex gap-2 flex-wrap">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {collection.datasheets} datasheets
                </span>
                <span className="font-mono text-[10px] text-muted-foreground ml-2">
                  {getEvidenceCount(collection)} evidence
                </span>
                <span className="font-mono text-[10px] text-muted-foreground ml-2">
                  {collection.components} components
                </span>
              </div>

              <div className="mt-3 flex gap-2">
                {/* Add Evidence button */}
                <Button
                  asChild
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setAddEvidenceTarget({ collection, evidence: mockEvidence[0] as Evidence })
                  }
                >
                  <Check className="size-3.5" />
                </Button>

                {/* Rename button */}
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  onClick={() => openRenameDrawer(collection)}
                >
                  Edit
                </Button>

                {/* Delete button */}
                <Button
                  asChild
                  size="sm"
                  variant="destructive"
                  onClick={() => openDeleteConfirm(collection)}
                >
                  <Trash className="size-3.5" />
                </Button>
              </div>

              {/* Add Evidence Drawer (opened from collection panel) */}
              {addEvidenceTarget && collection.id === addEvidenceTarget.collection.id && (
                <Drawer open={true} onOpenChange={setOpenDrawer}>
                  <DrawerOverlay className="bg-black/40" />
                  <DrawerContent className="sm:max-w-md pt-6">
                    <DrawerHeader>
                      <DrawerClose onClick={closeDrawer} />
                      <DrawerTitle>Add Evidence</DrawerTitle>
                      <DrawerDescription>
                        Add {addEvidenceTarget.evidence.title} to "{collection.name}"?
                      </DrawerDescription>
                    </DrawerHeader>

                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
                          <Check className="size-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{addEvidenceTarget.evidence.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {addEvidenceTarget.evidence.type} · Page{" "}
                            {addEvidenceTarget.evidence.page}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-6">
                        <Button
                          onClick={handleAddEvidenceConfirm}
                          className="flex-1 rounded-border border-primary px-3 py-2 text-[11px] font-medium text-primary hover:bg-primary/10"
                        >
                          Add
                        </Button>
                        <Button
                          onClick={closeDrawer}
                          className="flex-1 rounded-border border-border px-3 py-2 text-[11px] font-medium text-foreground hover:bg-background/50"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DrawerContent>
                </Drawer>
              )}

              {/* Remove Evidence mode - show evidence list with remove options */}
              {removeEvidenceTarget && collection.evidence > 0 && (
                <div className="mt-3 p-3 bg-muted/30 rounded-border border-border/20 text-[11px] text-muted-foreground">
                  <p className="mb-2">Evidence in collection: {collection.evidence}</p>
                  <p className="text-[10px]">
                    Click an evidence type below to remove one instance.
                  </p>
                  <div className="flex gap-2 flex-wrap mt-2">
                    <Button
                      asChild
                      size="icon"
                      variant="ghost"
                      onClick={() => setRemoveEvidenceTarget(null)}
                    >
                      <X className="size-3.5" />
                    </Button>
                    {/* Show removed evidence types dynamically - simplified */}
                    <span className="text-[9px]">
                      {collection.evidence} evidence item(s) removable
                    </span>
                  </div>
                </div>
              )}

              <Button asChild size="sm" variant="secondary" className="mt-2 w-full">
                <Link to="/app/evidence" search={{ doc: undefined, ev: undefined }}>
                  Open collection
                </Link>
              </Button>
            </li>
          ))}
        </ul>

        <DemoNotice />
      </div>
    </div>
  );
}
