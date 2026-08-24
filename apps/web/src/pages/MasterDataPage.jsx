// ---------------------------------------------------------------------------
// MasterDataPage — หน้าจัดการ master data แบบเดียว ใช้ซ้ำได้กับ Category/Location/Department/Vendor
// ขับเคลื่อนด้วย props (entityApi, fields, columns) แทนการเขียนหน้าแยกทีละประเภท
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Database, Edit3, Plus, RefreshCw, Search, SearchX, Trash2 } from 'lucide-react'
import MasterDataForm from '../components/MasterDataForm.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import './MasterData.css'

const PAGE_SIZE = 20

export default function MasterDataPage({ title, entityLabel, entityApi, fields, columns, searchPlaceholder }) {
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 })
  const [error, setError] = useState('')

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // สลับไปดู entity อื่น (เปลี่ยนแท็บ) -> เคลียร์ข้อมูลเก่าทิ้งและกลับไปหน้า 1/ล้างคำค้นหา
  // กันไม่ให้เห็นข้อมูลของ entity เดิมค้างอยู่ (แม้จะแค่แวบเดียวตอนกำลังโหลดข้อมูลใหม่)
  useEffect(() => {
    setPage(1)
    setSearchInput('')
    setSearch('')
    setItems([])
    setLoading(true)
  }, [entityApi])

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => { setPage(1) }, [search])

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const res = await entityApi.list({ page, pageSize: PAGE_SIZE, search })
      setItems(res.items)
      setMeta(res)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [entityApi, page, search])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditingItem(null)
    setFormOpen(true)
  }

  function openEdit(item) {
    setEditingItem(item)
    setFormOpen(true)
  }

  async function handleSubmit(payload) {
    if (editingItem) {
      await entityApi.update(editingItem.id, payload)
    } else {
      await entityApi.add(payload)
    }
    setFormOpen(false)
    setEditingItem(null)
    load()
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await entityApi.remove(deleteTarget.id)
      setDeleteTarget(null)
      if (items.length === 1 && page > 1) {
        setPage((p) => p - 1)
      } else {
        load()
      }
    } catch (err) {
      setError(err.message)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const hasSearch = search.length > 0
  const isEmpty = !loading && items.length === 0

  return (
    <section className="master-page">
      <header className="master-hero"><div><span><Database size={15} /> Master data</span><h1>{title}</h1><p>จัดการข้อมูลอ้างอิงที่ใช้ร่วมกันภายในระบบ</p></div><div><strong>{meta.totalItems}</strong><small>รายการทั้งหมด</small></div></header>

      <div className="master-toolbar">
        <label className="master-search"><Search size={18} /><input
          type="text"
          placeholder={searchPlaceholder || `ค้นหา${entityLabel}...`}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />{refreshing && <RefreshCw className="master-spin" size={16} />}</label>
        <button type="button" onClick={openCreate}><Plus size={17} /> เพิ่ม{entityLabel}</button>
      </div>

      {error && <div className="master-error" role="alert">{error}<button type="button" onClick={load}>ลองใหม่</button></div>}

      {loading ? (
        <div className="master-skeleton" aria-busy="true">{[1, 2, 3, 4].map((item) => <span key={item} />)}</div>
      ) : isEmpty ? (
        hasSearch ? (
          <div className="master-empty"><SearchX size={30} /><h3>ไม่พบผลลัพธ์</h3><p>ไม่พบ{entityLabel}ที่ตรงกับคำค้นหา “{search}”</p>
            <button className="secondary" onClick={() => setSearchInput('')}>ล้างการค้นหา</button>
          </div>
        ) : (
          <div className="master-empty"><Database size={30} /><h3>ยังไม่มี{entityLabel}</h3><p>เริ่มต้นด้วยการเพิ่ม{entityLabel}แรก</p>
            <button onClick={openCreate}><Plus size={16} /> เพิ่ม{entityLabel}</button>
          </div>
        )
      ) : (
        <>
          <div className={`master-table-wrap${refreshing ? ' is-refreshing' : ''}`}>
            <table>
              <thead>
                <tr>
                  {columns.map((col) => <th key={col.key}>{col.label}</th>)}
                  <th>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    {columns.map((col) => (
                      <td key={col.key}>{col.render ? col.render(item) : (item[col.key] ?? '-')}</td>
                    ))}
                    <td>
                      <div className="row">
                        <button type="button" className="master-edit" onClick={() => openEdit(item)}><Edit3 size={14} /> แก้ไข</button>
                        <button type="button" className="master-delete" onClick={() => setDeleteTarget(item)}><Trash2 size={14} /> ลบ</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="master-pagination"><span>หน้า {meta.page} จาก {meta.totalPages} · ทั้งหมด {meta.totalItems} รายการ</span><div>
              <button aria-label="หน้าก่อนหน้า" disabled={refreshing || meta.page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={17} /></button><b>{meta.page}</b>
              <button aria-label="หน้าถัดไป" disabled={refreshing || meta.page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={17} /></button>
            </div>
          </div>
        </>
      )}

      {formOpen && (
        <MasterDataForm
          title={editingItem ? `แก้ไข${entityLabel}` : `เพิ่ม${entityLabel}`}
          fields={fields}
          item={editingItem}
          onSubmit={handleSubmit}
          onCancel={() => { setFormOpen(false); setEditingItem(null) }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`ลบ${entityLabel}`}
          message={<div className="delete-summary"><div className="delete-summary-tag">{deleteTarget.name}</div></div>}
          note={`การลบจะซ่อน${entityLabel}นี้จากตัวเลือกใหม่ ๆ แต่ครุภัณฑ์ที่เคยผูกไว้จะยังแสดงผลตามปกติ`}
          confirmLabel="ลบ"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </section>
  )
}
