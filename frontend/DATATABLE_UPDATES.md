# DataTable Layout Updates

## Changes Made

### 1. **Global DataTableLayout Component** ✅
   - Created reusable component at: `src/components/common/DataTableLayout.tsx`
   - Removed old sample file: `DataTableLayout- sample.tsx`

### 2. **Design Updates** ✅

#### Header Section
- ❌ Removed title and subtitle (now optional props)
- ❌ Removed search icon (clean input field)
- ❌ Removed filter icon
- ✅ All elements (chips, search, filters, actions) in single horizontal line
- ✅ Added gray background color (`bg-gray-50`)
- ✅ Consistent padding (`px-6 py-3`)
- ✅ Action buttons are icon-only with tooltips

#### Table Section
- ✅ Added S.No column (auto-calculated based on page and index)
- ✅ Scrollable content area
- ✅ Sticky header with shadow

#### Footer Section
- ✅ Added gray background color (`bg-gray-50`)
- ✅ Consistent padding (`px-6 py-3`)
- ✅ Pagination controls with checkbox
- ✅ Rows per page selector
- ✅ Page navigation with ellipsis
- ✅ "Go to" page dropdown
- ✅ Total count display

### 3. **Cookie-Based Pagination** ✅
- Pagination enabled/disabled state stored in cookies
- Cookie name: `{cookiePrefix}_pagination_enabled`
- Expires: 30 days
- Persists across browser sessions

### 4. **Updated Pages** ✅

#### Branches Page (`src/pages/company/Branches.tsx`)
- ✅ Migrated to new DataTableLayout
- ✅ Added S.No column
- ✅ Icon-only action buttons
- ✅ Cookie prefix: `branches`
- ✅ Stats chips: Total, Active, Inactive

#### Staff Page (`src/pages/company/Staff.tsx`)
- ✅ Migrated to new DataTableLayout
- ✅ Added S.No column
- ✅ Icon-only action buttons
- ✅ Cookie prefix: `staff`
- ✅ Stats chips: Total, Active, Inactive
- ✅ Role filter dropdown

### 5. **Features** ✅

#### Responsive Design
- Mobile: Simplified layout with condensed controls
- Desktop: Full layout with all features

#### Pagination Features
- ✅ Enable/disable pagination (stored in cookies)
- ✅ Rows per page: 10, 20, 50, 100
- ✅ Page navigation with Previous/Next
- ✅ Smart ellipsis for many pages
- ✅ "Go to" page dropdown
- ✅ Total count display

#### Search & Filter
- ✅ Clean search input (no icon inside)
- ✅ Custom filter components support
- ✅ Real-time search

#### Actions
- ✅ Refresh button with loading spinner
- ✅ Custom action buttons (icon-only)
- ✅ Tooltips on all action buttons

#### Empty States
- ✅ Customizable icon, title, description
- ✅ Optional action button

## File Structure

```
RestaurantOs_Final/frontend/src/
├── components/
│   └── common/
│       ├── DataTableLayout.tsx          ← New global component
│       └── README.md                     ← Component documentation
└── pages/
    └── company/
        ├── Branches.tsx                  ← Updated to use DataTableLayout
        └── Staff.tsx                     ← Updated to use DataTableLayout
```

## Usage Example

```tsx
<DataTableLayout
  // Stats (inline with search/filters)
  statChips={[
    { label: 'Total', value: 100 },
    { label: 'Active', value: 80, bgColor: 'bg-green-100 text-green-800' },
  ]}
  
  // Icon-only action buttons
  actionButtons={[
    {
      icon: <Plus className="h-4 w-4" />,
      tooltip: 'Add new item',
      onClick: handleAdd,
    },
  ]}
  
  // Search (no icon)
  searchValue={searchTerm}
  onSearchChange={setSearchTerm}
  
  // Filter
  filterConfig={{
    component: <Select>...</Select>
  }}
  
  // Table with S.No
  tableHeaders={
    <>
      <TableHead className="w-16">S.No</TableHead>
      <TableHead>Name</TableHead>
      ...
    </>
  }
  tableBody={
    <>
      {data.map((item, index) => (
        <TableRow key={item.id}>
          <TableCell>{(currentPage - 1) * rowsPerPage + index + 1}</TableCell>
          <TableCell>{item.name}</TableCell>
          ...
        </TableRow>
      ))}
    </>
  }
  
  // Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  totalCount={totalCount}
  rowsPerPage={rowsPerPage}
  onPageChange={setCurrentPage}
  onRowsPerPageChange={setRowsPerPage}
  
  // Refresh
  onRefresh={fetchData}
  
  // Cookie prefix
  cookiePrefix="my_table"
/>
```

## Key Improvements

1. **Cleaner UI**: Removed unnecessary icons and text, more space-efficient
2. **Consistent Layout**: Fixed header/footer with gray backgrounds
3. **Better UX**: All controls in single line, easier to access
4. **Persistent Settings**: Pagination preferences saved in cookies
5. **Reusable**: Single component for all data tables
6. **Responsive**: Works on mobile and desktop
7. **Accessible**: Tooltips, keyboard navigation, semantic HTML

## Testing Checklist

- [ ] Branches page loads correctly
- [ ] Staff page loads correctly
- [ ] S.No column shows correct numbers
- [ ] Pagination toggle works and persists
- [ ] Search filters data correctly
- [ ] Role filter works (Staff page)
- [ ] Action buttons work (Add, Edit, Delete, Toggle)
- [ ] Refresh button works
- [ ] Empty states display correctly
- [ ] Mobile responsive layout works
- [ ] Cookie persistence works across page refreshes
