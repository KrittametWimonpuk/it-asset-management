import { Columns3, Filter, Plus, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { STATUS_OPTIONS } from './AssetForm.jsx'

const SELECT_FILTERS = [
  { key: 'categoryId', label: 'หมวดหมู่' },
  { key: 'status', label: 'สถานะ' },
  { key: 'locationId', label: 'สถานที่ตั้ง' },
  { key: 'departmentId', label: 'แผนก' },
  { key: 'vendorId', label: 'ผู้ขาย/ผู้ผลิต' },
]

export default function AssetFilterBar({
  searchInput, onSearchChange, filters, onFilterChange, onReset, options, optionsError,
  canManage, onAddAsset, columns, onToggleColumn, columnsOpen, onToggleColumnsPanel,
  filtersOpen, onToggleFilters, activeFilterCount,
}) {
  function optionsFor(key) {
    if (key === 'status') return STATUS_OPTIONS
    return (options?.[key] || []).map((item) => ({ value: item.id, label: item.name }))
  }

  return (
    <div className="assets-controls-card">
      <div className="assets-toolbar">
        <div className="assets-search-wrap">
          <Search size={18} aria-hidden="true" />
          <input
            id="asset-search"
            type="search"
            placeholder="ค้นหา Asset Tag, ชื่อ, Serial, Hostname หรือ IP..."
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="ค้นหาครุภัณฑ์"
          />
          {searchInput && (
            <button className="assets-clear-search" type="button" onClick={() => onSearchChange('')} aria-label="ล้างคำค้นหา">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="assets-toolbar-actions">
          <button
            type="button"
            className={`assets-control-button${filtersOpen ? ' is-active' : ''}`}
            onClick={onToggleFilters}
            aria-expanded={filtersOpen}
            aria-controls="asset-advanced-filters"
          >
            <SlidersHorizontal size={17} /> ตัวกรอง
            {activeFilterCount > 0 && <span className="assets-control-count">{activeFilterCount}</span>}
          </button>

          <div className="assets-columns-picker">
            <button
              type="button"
              className={`assets-control-button${columnsOpen ? ' is-active' : ''}`}
              onClick={onToggleColumnsPanel}
              aria-expanded={columnsOpen}
            >
              <Columns3 size={17} /> คอลัมน์
            </button>
            {columnsOpen && (
              <div className="assets-columns-panel" role="group" aria-label="เลือกคอลัมน์ที่แสดง">
                <div className="assets-columns-heading">
                  <span>แสดงคอลัมน์</span>
                  <small>{columns.filter((column) => column.visible).length}/{columns.length}</small>
                </div>
                <div className="assets-columns-list">
                  {columns.map((column) => (
                    <label key={column.key} className="assets-column-option">
                      <input type="checkbox" checked={column.visible} onChange={() => onToggleColumn(column.key)} />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {canManage && (
            <button type="button" className="assets-add-button" onClick={onAddAsset}>
              <Plus size={18} /> เพิ่มครุภัณฑ์
            </button>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="assets-advanced-filters" id="asset-advanced-filters">
          <div className="assets-filter-heading">
            <span><Filter size={16} /> ตัวกรองขั้นสูง</span>
            {activeFilterCount > 0 && (
              <button type="button" className="assets-reset-button" onClick={onReset}>
                <RotateCcw size={15} /> รีเซ็ตทั้งหมด
              </button>
            )}
          </div>
          <div className="assets-filter-grid">
            {SELECT_FILTERS.map((filter) => (
              <div className="assets-filter-field" key={filter.key}>
                <label htmlFor={`filter-${filter.key}`}>{filter.label}</label>
                <select
                  id={`filter-${filter.key}`}
                  value={filters[filter.key]}
                  onChange={(event) => onFilterChange(filter.key, event.target.value)}
                  disabled={filter.key !== 'status' && !options}
                >
                  <option value="">ทั้งหมด</option>
                  {optionsFor(filter.key).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {optionsError && <p className="assets-inline-error">{optionsError}</p>}
    </div>
  )
}
