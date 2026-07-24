# Flow Canvas User Guide

Flow Canvas is used to design AI workflows, approval chains, and data flows as stage rectangles, nodes, and directional edges.

## Create or Open a Flow

1. Open the flow manager from the dashboard icon in the top toolbar.
2. Choose an existing AI workflow or approval chain, or use `+ Create` from the manager page.
3. Pick `AI workflow` or `Approval chain` when creating a new item.
4. For approval chains, choose a chain type such as underwriting, data engineering, project approval, procurement, or model governance.
5. In the editor, use the flow name field in the top bar to rename the flow.

## Add Stage Rectangles

Stage rectangles are the large background boxes behind nodes. Use them to group phases such as data sources, processing, modeling, review, approval, deployment, or monitoring.

1. Click `Add stage rectangle` in the top toolbar, or use `Stage rectangle` in the left library under Canvas Structure.
2. Drag the stage rectangle to reposition it.
3. Select the stage and use the right panel to edit its title, description, and color.
4. Select the stage and drag its resize handles to change its size.
5. Each stage receives a default palette color. If you choose a different color from the dropdown, the right panel shows a note that the stage is using a non-default color.

## Add Nodes

1. Search or browse the left Node Library.
2. Drag a node onto the canvas, or click a node in the library to add it.
3. Select the node and edit its name, description, owner, technology, status, provider, governance, and configuration in the right panel.
4. For provider-backed nodes, choose a provider in the right panel. The node icon updates when a provider logo is available.
5. Use the vertical three-dot menu in the node's top-right corner and choose `Icon` to preview the provider icon library.

## Use Approval Chains

1. Create an `Approval chain` from the flow manager.
2. Select the overall flow to set the approval chain type.
3. Use the `Approver LiteSQL Table` in the right panel to add approvers for the current chain type.
4. Select any approval-chain node to open its `Document Viewer`.
5. Use the PDF tab to preview the node SOP inline, or use the DOC tab to open the Word review packet.
6. Select an `Approver Assignment`, `Human Review`, or `Approval` node to choose an approver from the table, then edit the due date, review document link, and instructions.
7. Select the overall flow to see the linked dummy review documents in the right panel.

## Create Edges

1. Hover a node to reveal side connection dots.
2. Click and hold one dot, then drag to another node.
3. Release on the target node. The edge is created and stored in the flow.
4. The target side is chosen from the closest side of the square where you release.

## Move Existing Edge Ends

1. Move the cursor to an edge endpoint. The endpoint knot appears on hover.
2. If several edges share the same node-side dot, their knots split into separate pieces around that side.
3. Hover a split knot to highlight the matching edge.
4. Drag that knot to another node or another side of a node to reconnect it.
5. Use the `+` action at the endpoint to drag out another edge from that same end.
6. Use the `-` action at the endpoint to delete that exact edge.
7. Select an edge to adjust its label, type, curvature, source side, and target side in the right panel.

## Export and Share

1. Use `Export PDF` to download the visible flow canvas as a PDF.
2. Use `Export image` for a PNG snapshot.
3. Use `Export JSON` to save the flow data.
4. Use `Import JSON` to load a saved flow.

## Useful Shortcuts

- `Cmd/Ctrl + S`: save.
- `Cmd/Ctrl + K`: focus node search.
- `Cmd/Ctrl + Z`: undo.
- `Cmd/Ctrl + Shift + Z`: redo.
- `Cmd/Ctrl + D`: duplicate selected node.
- `Delete` or `Backspace`: delete selected node, edge, or stage.
- `Esc`: clear selection.
