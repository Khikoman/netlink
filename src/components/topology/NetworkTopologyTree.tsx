"use client";

import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { OLT, ODF, ODFPort, Enclosure, Port } from "@/types";
import {
  Server,
  ChevronRight,
  ChevronDown,
  Box,
  Link2,
  GitBranch,
  Network,
  Users,
  Search,
  RefreshCw,
  Circle,
  MapPin,
} from "lucide-react";

interface NetworkTopologyTreeProps {
  projectId: number;
}

interface TreeNode {
  id: string;
  type: "olt" | "odf" | "closure" | "lcp" | "nap" | "customer";
  name: string;
  data: OLT | ODF | Enclosure | Port;
  children: TreeNode[];
  stats?: {
    total?: number;
    connected?: number;
  };
  gpsLat?: number;
  gpsLng?: number;
}

export default function NetworkTopologyTree({ projectId }: NetworkTopologyTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

  // Fetch all data
  const olts = useLiveQuery(() => db.olts.where("projectId").equals(projectId).toArray(), [projectId]);
  const odfs = useLiveQuery(() => db.odfs.where("projectId").equals(projectId).toArray(), [projectId]);
  const odfPorts = useLiveQuery(() => db.odfPorts.toArray(), []);
  const enclosures = useLiveQuery(() => db.enclosures.where("projectId").equals(projectId).toArray(), [projectId]);
  const ports = useLiveQuery(() => db.ports.toArray(), []);

  // Build tree structure
  const treeData = useMemo(() => {
    if (!olts || !odfs || !odfPorts || !enclosures || !ports) return [];

    const trees: TreeNode[] = [];

    // Process each OLT
    olts.forEach((olt) => {
      const oltNode: TreeNode = {
        id: `olt-${olt.id}`,
        type: "olt",
        name: olt.name,
        data: olt,
        children: [],
        gpsLat: olt.gpsLat,
        gpsLng: olt.gpsLng,
      };

      // Get ODFs for this OLT
      const oltODFs = odfs.filter((odf) => odf.oltId === olt.id);

      if (oltODFs.length > 0) {
        oltODFs.forEach((odf) => {
          const odfNode: TreeNode = {
            id: `odf-${odf.id}`,
            type: "odf",
            name: odf.name,
            data: odf,
            children: [],
            gpsLat: odf.gpsLat,
            gpsLng: odf.gpsLng,
          };

          // Get ODF ports with connected closures
          const odfPortsForOdf = odfPorts.filter((p) => p.odfId === odf.id);
          const connectedClosureIds = odfPortsForOdf
            .filter((p) => p.closureId)
            .map((p) => p.closureId);

          // Get closures connected via ODF
          const closuresViaOdf = enclosures.filter(
            (enc) => connectedClosureIds.includes(enc.id) ||
                     (enc.parentType === "odf" && enc.parentId === odf.id)
          );

          closuresViaOdf.forEach((closure) => {
            const closureNode = buildClosureNode(closure, enclosures, ports);
            odfNode.children.push(closureNode);
          });

          // ODF stats
          odfNode.stats = {
            total: odf.portCount,
            connected: odfPortsForOdf.filter((p) => p.status === "connected").length,
          };

          oltNode.children.push(odfNode);
        });
      }

      // Get closures directly under OLT (legacy or direct connection)
      const directClosures = enclosures.filter(
        (enc) => enc.parentType === "olt" && enc.parentId === olt.id && enc.type === "splice-closure"
      );

      directClosures.forEach((closure) => {
        const closureNode = buildClosureNode(closure, enclosures, ports);
        oltNode.children.push(closureNode);
      });

      // Calculate OLT stats
      let totalCustomers = 0;
      let connectedCustomers = 0;
      const countCustomers = (node: TreeNode) => {
        if (node.type === "nap") {
          const napPorts = ports.filter((p) => p.enclosureId === (node.data as Enclosure).id);
          totalCustomers += napPorts.length;
          connectedCustomers += napPorts.filter((p) => p.status === "connected").length;
        }
        node.children.forEach(countCustomers);
      };
      oltNode.children.forEach(countCustomers);
      oltNode.stats = { total: totalCustomers, connected: connectedCustomers };

      trees.push(oltNode);
    });

    return trees;
  }, [olts, odfs, odfPorts, enclosures, ports]);

  // Build closure node with LCPs and NAPs
  function buildClosureNode(
    closure: Enclosure,
    allEnclosures: Enclosure[],
    allPorts: Port[]
  ): TreeNode {
    const closureNode: TreeNode = {
      id: `closure-${closure.id}`,
      type: "closure",
      name: closure.name,
      data: closure,
      children: [],
      gpsLat: closure.gpsLat,
      gpsLng: closure.gpsLng,
    };

    // Get LCPs under this closure
    const lcps = allEnclosures.filter(
      (enc) =>
        enc.parentType === "closure" &&
        enc.parentId === closure.id &&
        (enc.type === "lcp" || enc.type === "fdt")
    );

    lcps.forEach((lcp) => {
      const lcpNode: TreeNode = {
        id: `lcp-${lcp.id}`,
        type: "lcp",
        name: lcp.name,
        data: lcp,
        children: [],
        gpsLat: lcp.gpsLat,
        gpsLng: lcp.gpsLng,
      };

      // Get NAPs under this LCP
      const naps = allEnclosures.filter(
        (enc) =>
          enc.parentType === "lcp" &&
          enc.parentId === lcp.id &&
          (enc.type === "nap" || enc.type === "fat")
      );

      naps.forEach((nap) => {
        const napPorts = allPorts.filter((p) => p.enclosureId === nap.id);
        const napNode: TreeNode = {
          id: `nap-${nap.id}`,
          type: "nap",
          name: nap.name,
          data: nap,
          children: [],
          stats: {
            total: napPorts.length,
            connected: napPorts.filter((p) => p.status === "connected").length,
          },
          gpsLat: nap.gpsLat,
          gpsLng: nap.gpsLng,
        };

        // Add connected customers as children
        napPorts
          .filter((p) => p.status === "connected" && p.customerName)
          .forEach((port) => {
            napNode.children.push({
              id: `customer-${port.id}`,
              type: "customer",
              name: port.customerName || `Port ${port.portNumber}`,
              data: port,
              children: [],
              gpsLat: port.customerGpsLat,
              gpsLng: port.customerGpsLng,
            });
          });

        lcpNode.children.push(napNode);
      });

      // LCP stats
      let totalNapPorts = 0;
      let connectedNapPorts = 0;
      lcpNode.children.forEach((napNode) => {
        totalNapPorts += napNode.stats?.total || 0;
        connectedNapPorts += napNode.stats?.connected || 0;
      });
      lcpNode.stats = { total: totalNapPorts, connected: connectedNapPorts };

      closureNode.children.push(lcpNode);
    });

    // Closure stats
    let totalPorts = 0;
    let connectedPorts = 0;
    closureNode.children.forEach((lcpNode) => {
      totalPorts += lcpNode.stats?.total || 0;
      connectedPorts += lcpNode.stats?.connected || 0;
    });
    closureNode.stats = { total: totalPorts, connected: connectedPorts };

    return closureNode;
  }

  // Filter nodes by search query
  const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
    if (!query) return nodes;
    const lowerQuery = query.toLowerCase();

    return nodes
      .map((node) => {
        const matchesName = node.name.toLowerCase().includes(lowerQuery);
        const filteredChildren = filterTree(node.children, query);

        if (matchesName || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
        return null;
      })
      .filter((node): node is TreeNode => node !== null);
  };

  const filteredTree = filterTree(treeData, searchQuery);

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Expand all nodes
  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (nodes: TreeNode[]) => {
      nodes.forEach((node) => {
        allIds.add(node.id);
        collectIds(node.children);
      });
    };
    collectIds(treeData);
    setExpandedNodes(allIds);
  };

  // Collapse all nodes
  const collapseAll = () => {
    setExpandedNodes(new Set());
  };

  const getNodeIcon = (type: TreeNode["type"]) => {
    switch (type) {
      case "olt":
        return <Server className="w-4 h-4 text-teal-600" />;
      case "odf":
        return <Box className="w-4 h-4 text-cyan-600" />;
      case "closure":
        return <Link2 className="w-4 h-4 text-purple-600" />;
      case "lcp":
        return <GitBranch className="w-4 h-4 text-orange-600" />;
      case "nap":
        return <Network className="w-4 h-4 text-blue-600" />;
      case "customer":
        return <Users className="w-4 h-4 text-green-600" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getNodeColor = (type: TreeNode["type"]) => {
    switch (type) {
      case "olt":
        return "bg-teal-50 border-teal-200";
      case "odf":
        return "bg-cyan-50 border-cyan-200";
      case "closure":
        return "bg-purple-50 border-purple-200";
      case "lcp":
        return "bg-orange-50 border-orange-200";
      case "nap":
        return "bg-blue-50 border-blue-200";
      case "customer":
        return "bg-green-50 border-green-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-gray-800">Network Topology</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-100 rounded"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-100 rounded"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search network elements..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
          />
        </div>
      </div>

      {/* Tree Content */}
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {filteredTree.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? (
              <p>No results found for &quot;{searchQuery}&quot;</p>
            ) : (
              <div>
                <Network className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                <p>No network elements yet.</p>
                <p className="text-sm mt-1">Add OLTs from the Hierarchy Browser to see the topology.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTree.map((node) => (
              <TreeNodeComponent
                key={node.id}
                node={node}
                level={0}
                expandedNodes={expandedNodes}
                onToggle={toggleNode}
                onSelect={setSelectedNode}
                selectedNodeId={selectedNode?.id}
                getNodeIcon={getNodeIcon}
                getNodeColor={getNodeColor}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="border-t p-4 bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            {getNodeIcon(selectedNode.type)}
            <h4 className="font-semibold text-gray-800">{selectedNode.name}</h4>
            <span className="text-xs px-2 py-0.5 bg-gray-200 rounded-full text-gray-600">
              {selectedNode.type.toUpperCase()}
            </span>
          </div>
          {selectedNode.stats && (
            <div className="flex items-center gap-4 text-sm text-gray-600">
              {selectedNode.stats.total !== undefined && (
                <span>Total: {selectedNode.stats.total}</span>
              )}
              {selectedNode.stats.connected !== undefined && (
                <span className="text-green-600">
                  Connected: {selectedNode.stats.connected}
                </span>
              )}
              {selectedNode.stats.total !== undefined &&
                selectedNode.stats.connected !== undefined && (
                  <span className="text-blue-600">
                    Utilization:{" "}
                    {selectedNode.stats.total > 0
                      ? Math.round(
                          (selectedNode.stats.connected / selectedNode.stats.total) * 100
                        )
                      : 0}
                    %
                  </span>
                )}
            </div>
          )}
          {selectedNode.gpsLat && selectedNode.gpsLng && (
            <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
              <MapPin className="w-3 h-3" />
              <span>
                {selectedNode.gpsLat.toFixed(6)}, {selectedNode.gpsLng.toFixed(6)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Tree Node Component
function TreeNodeComponent({
  node,
  level,
  expandedNodes,
  onToggle,
  onSelect,
  selectedNodeId,
  getNodeIcon,
  getNodeColor,
}: {
  node: TreeNode;
  level: number;
  expandedNodes: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: TreeNode) => void;
  selectedNodeId?: string;
  getNodeIcon: (type: TreeNode["type"]) => React.ReactNode;
  getNodeColor: (type: TreeNode["type"]) => string;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer
          transition-colors border
          ${isSelected ? getNodeColor(node.type) : "border-transparent hover:bg-gray-50"}
        `}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="p-0.5 hover:bg-gray-200 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {getNodeIcon(node.type)}

        <span className="text-sm font-medium text-gray-700 flex-1">{node.name}</span>

        {node.stats && node.stats.total !== undefined && (
          <span className="text-xs text-gray-500">
            {node.stats.connected}/{node.stats.total}
          </span>
        )}

        {node.gpsLat && node.gpsLng && (
          <MapPin className="w-3 h-3 text-green-500" />
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedNodeId={selectedNodeId}
              getNodeIcon={getNodeIcon}
              getNodeColor={getNodeColor}
            />
          ))}
        </div>
      )}
    </div>
  );
}
