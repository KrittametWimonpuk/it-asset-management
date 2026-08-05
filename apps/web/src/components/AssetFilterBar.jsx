// ---------------------------------------------------------------------------
// AssetFilterBar — แถบค้นหา + กรอง + ตั้งค่าคอลัมน์ เหนือตารางครุภัณฑ์ (Milestone 4.1)
//
// เป็น presentational component ล้วน ๆ (รับ props เข้า, เรียก callback ออก) — state จริงอยู่ที่ Assets.jsx
// ตัวกรอง category/location/department/vendor ใช้ตัวเลือกจาก useMasterDataOptions (โหลดครั้งเดียว ใช้ซ้ำกับ AssetForm ได้)
// ---------------------------------------------------------------------------
import { STATUS_OPTIONS } from './AssetForm.jsx'

// ต้องตรงกับ key ที่ useMasterDataOptions คืนมา (categoryId/locationId/departmentId/vendorId)
const SELECT_FILTERS = [
  { key: 'categoryId', label: 'หมวดหมู่' },
  { key: 'status', label: 'สถานะ' },
  { key: 'locationId', label: 'สถานที่ตั้ง' },
  { key: 'departmentId', label: 'แผนก' },
  { key: 'vendorId', label: 'ผู้ขาย/ผู้ผลิต' },
]

export default function AssetFilterBar({
  searchInput,
  onSearchChange,
  filters,
  onFilterChange,
  onReset,
  options,
  optionsError,
  canManage,
  onAddAsset,
  columns,
  onToggleColumn,
  columnsOpen,
  onToggleColumnsPanel,
}) {
  // ตัวเลือกของแต่ละ select — status ใช้ค่าคงที่ ที่เหลือโหลดจาก master data API
  function optionsFor(key) {
    if (key === 'status') return STATUS_OPTIONS
    return (options?.[key] || []).map((item) => ({ value: item.id, label: item.name }))
  }

  return (
    <div className="filter-bar mt">
      <div className="filter-field">
        <label htmlFor="asset-search">ค้นหา</label>
        <input
          id="asset-search"
          type="text"
          className="search-input"
          placeholder="ค้นหา Asset Tag, ชื่อ, ยี่ห้อ, รุ่น, Serial Number, Hostname, IP, MAC, OS..."
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {SELECT_FILTERS.map((f) => (
        <div className="filter-field" key={f.key}>
          <label htmlFor={`filter-${f.key}`}>{f.label}</label>
          <select
            id={`filter-${f.key}`}
            value={filters[f.key]}
            onChange={(e) => onFilterChange(f.key, e.target.value)}
            disabled={f.key !== 'status' && !options}
          >
            <option value="">ทั้งหมด</option>
            {optionsFor(f.key).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      ))}

      <div className="filter-actions">
        <button type="button" className="secondary" onClick={onReset}>รีเซ็ตตัวกรอง</button>

        <div className="columns-picker">
          <button type="button" className="secondary" onClick={onToggleColumnsPanel} aria-expanded={columnsOpen}>
            คอลัมน์
          </button>
          {columnsOpen && (
            <div className="columns-panel">
              {columns.map((c) => (
                <label key={c.key} className="columns-panel-item">
                  <input type="checkbox" checked={c.visible} onChange={() => onToggleColumn(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>

        {canManage && <button type="button" onClick={onAddAsset}>+ เพิ่มครุภัณฑ์ใหม่</button>}
      </div>

      {optionsError && <p className="error">{optionsError}</p>}
    </div>
  )
}
