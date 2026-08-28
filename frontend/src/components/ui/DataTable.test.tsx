import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import en from "@/i18n/en.json";

import "@/i18n";

type Row = { id: number; number: string; subject: string };

const rows: Row[] = [
  { id: 1, number: "TK-4821", subject: "Payment failed" },
  { id: 2, number: "TK-4818", subject: "Second branch" },
];

const columns: Column<Row>[] = [
  { key: "number", header: "Ticket", sortable: true, cell: (row) => row.number },
  { key: "subject", header: "Subject", cell: (row) => row.subject },
  { key: "id", header: "Id", align: "end", cell: (row) => row.id },
];

describe("DataTable", () => {
  it("renders rows", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />);

    expect(screen.getByText("TK-4821")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(rows.length + 1);
  });

  it("renders skeleton rows while loading, and no empty state", () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(row) => row.id} isLoading skeletonRows={3} />);

    expect(screen.getAllByTestId("table-skeleton-row")).toHaveLength(3);
    expect(screen.queryByTestId("table-empty")).not.toBeInTheDocument();
  });

  it("renders the empty state when a finished load returned nothing", () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(row) => row.id} />);

    expect(screen.getByTestId("table-empty")).toBeInTheDocument();
    expect(screen.getByText(en.empty.title)).toBeInTheDocument();
  });

  it("hands sorting back to the caller instead of re-sorting the page itself", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={null}
        onSortChange={onSortChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ticket/ }));
    expect(onSortChange).toHaveBeenCalledWith({ key: "number", direction: "asc" });

    // The rows on screen are untouched — the caller re-queries and re-renders.
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("TK-4821");
  });

  it("cycles asc → desc → unsorted", () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={{ key: "number", direction: "asc" }}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ticket/ }));
    expect(onSortChange).toHaveBeenLastCalledWith({ key: "number", direction: "desc" });

    rerender(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        sort={{ key: "number", direction: "desc" }}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Ticket/ }));
    expect(onSortChange).toHaveBeenLastCalledWith(null);
  });

  it("aligns with logical properties so the table mirrors in Arabic", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />);

    const idHeader = screen.getByRole("columnheader", { name: "Id" });
    expect(idHeader.className).toContain("text-end");
    // The guard's escape hatch, used here for its intended purpose: this line
    // asserts the utility's ABSENCE, so the string must appear to mean anything.
    expect(idHeader.className).not.toContain("text-right"); // rtl-ok
  });

  it("pages only when there is more than one page", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} onPageChange={onPageChange} />,
    );
    expect(screen.queryByTitle(en.table.next)).not.toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        page={1}
        pageCount={4}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByTitle(en.table.previous)).toBeDisabled();
    fireEvent.click(screen.getByTitle(en.table.next));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
