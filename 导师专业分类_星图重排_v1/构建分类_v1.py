# -*- coding: utf-8 -*-
"""v11：以人才星图为骨架的 L3 唯一化重排（读取上传映射表转译）。
核心规则：
- L3 严格以人才星图专业圈为准，不新增/不减少
- 师带徒独有、星图未列的方向并入最近星图 L3（作为 L4/L5）：
  · 燃料燃管（师带徒有争议专业）→ 并入「燃料运行专业」
  · 节能专业（师带徒有、星图无）→ 并入「机务专业」
- 读入上传版映射表，仅做目标 L3 重映射 + 来源标注，其余内容原样保留
"""
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from collections import Counter, OrderedDict

SRC = '源文件/五层专业分类映射表_上传版.xlsx'
OUT = '五层专业分类参照表.xlsx'

# ---- 读取上传表全部数据行（8列, 含H说明） ----
src_wb = openpyxl.load_workbook(SRC, data_only=True)
src_ws = src_wb.active
rows = []
for r in src_ws.iter_rows(min_row=3, values_only=True):
    if r[0] is None or r[0] in ('五层专业分类映射表', '专业类别(L1)'):
        continue
    rows.append(list(r))

# ---- L2 维度归一化为星图原文 ----
L2MAP = {'火电': '火电生产', '水电': '水电生产', '新能源': '新能源生产'}
for r in rows:
    if r[1] in L2MAP:
        r[1] = L2MAP[r[1]]
    # 星图原文：管理区 A=管理，无独立维度层；保留扩展占位"管理类"

# ---- 管理 L3 方向对齐星图原文 ----
L3MAP = {'办公室': '办公室（企法）'}
for r in rows:
    if r[0] == '管理' and r[2] in L3MAP:
        r[2] = L3MAP[r[2]]

# ---- L3 重映射（非星图方向并入星图方向） ----
MERGE = {
    '燃料燃管': ('燃料运行专业', '划入', '师带徒"燃料燃管"（有争议专业），并入星图"燃料运行专业"'),
    '节能专业': ('机务专业', '划入', '师带徒有"节能"、星图无此方向，并入星图"机务专业"'),
}
n_merge = 0
for r in rows:
    l3 = r[2]
    if l3 in MERGE:
        new_l3, st, note = MERGE[l3]
        r[2] = new_l3
        r[5] = st
        r[6] = note
        n_merge += 1

# 星图 L3 排序表（决定输出次序）：火电生产→水电生产→新能源生产→管理
ORDER = [
    # 火电生产
    ('技能','火电生产','机务专业'),('技能','火电生产','电控专业'),('技能','火电生产','集控专业'),
    ('技能','火电生产','除灰运行专业'),('技能','火电生产','化学专业'),('技能','火电生产','燃料运行专业'),
    # 水电生产
    ('技能','水电生产','水文专业'),('技能','水电生产','水工专业'),('技能','水电生产','运行专业'),
    ('技能','水电生产','电气专业'),('技能','水电生产','机械专业'),('技能','水电生产','供电专业'),
    # 新能源生产
    ('技能','新能源生产','风电运维'),('技能','新能源生产','集控运行'),
]
# 管理类按上传表出现顺序附加
mgmt_order = [ (r[0],r[1],r[2]) for r in rows if r[0]=='管理' ]
for m in mgmt_order:
    if m not in ORDER:
        ORDER.append(m)

# 按 ORDER 排序；管理类内部维持上传表相对顺序
pos = {k:i for i,k in enumerate(ORDER)}
for k in ORDER:
    pos.setdefault(k, len(pos))
rows.sort(key=lambda r: pos.get((r[0],r[1],r[2]), 999))

# ---- 方案B：调速器（星图原L4）独立保留 + 新增"辅机设备" ----
# 星图原机械专业 L4={水轮机,发电机,调速器,起重}，调速器保留为独立L4
# 新增 L4"辅机设备"收纳调速以外的全机组辅助系统（油/供水/气/排水）
S3 = ['技能', '水电生产', '机械专业']
mb = [r for r in rows if r[:3] == S3]
if mb:
    rows = [r for r in rows if r[:3] != S3]
    for r in mb:
        if r[3] == '调速器' and r[4] == '辅机':
            r[4] = '调速系统（油压装置）'
            r[5] = '原有'
            r[6] = '星图原"调速器"L4保留；原师带徒"辅机"细分并入独立"辅机设备"，此处置为调速系统细分'
    aux = [
        ('油系统', '透平油、绝缘油、油处理'),
        ('技术供水系统', '冷却供水、主轴密封供水'),
        ('压缩空气系统', '高压气、低压气'),
        ('排水系统（渗漏/检修）', '渗漏排水、检修排水'),
    ]
    star = '星图含：水轮机、发电机、调速器、起重'
    k = next((k for k, r in enumerate(mb) if r[3] == '起重'), len(mb))
    for name, detail in reversed(aux):
        mb.insert(k, ['技能', '水电生产', '机械专业', '辅机设备', name,
                      '新增', '【新增】星图原"机械专业"（水轮机/发电机/调速器/起重），按全机组辅机口径补"' + name + '"', star])
    rows.extend(mb)
    rows.sort(key=lambda r: pos.get((r[0], r[1], r[2]), 999))

# ---- 写入 Excel ----
wb = openpyxl.Workbook()
ws = wb.active
ws.title = '五层专业分类参照表'

thin = Side(style='thin', color='BBBBBB')
border = Border(left=thin, right=thin, top=thin, bottom=thin)
title_font = Font(name='微软雅黑', size=16, bold=True)
head_font = Font(name='微软雅黑', size=11, bold=True, color='FFFFFF')
head_fill = PatternFill('solid', fgColor='3B5B92')
admin_fill = PatternFill('solid', fgColor='FBF3E5')   # 管理类浅色
skill_fill = PatternFill('solid', fgColor='EAF0F8')   # 技能类浅色
body_font = Font(name='微软雅黑', size=10)
src_font = Font(name='微软雅黑', size=10, color='555555')
ac = Alignment(horizontal='center', vertical='center', wrap_text=True)
al = Alignment(horizontal='left', vertical='center', wrap_text=True)

ws.append(['五层专业分类映射表（v11·以人才星图为骨架，L3以星图为准）'])
ws.append(['专业类别(L1)','专业维度(L2)','专业方向(L3)','专业岗位(L4)','岗位细分(L5)','来源状态','细分来源说明','原表包含岗位说明'])

# 按 L1/L2/L3 合并单元格：遍历已排序 rows 分组
def key3(r): return (r[0],r[1],r[2])
data_rows = rows  # 已排序

# 先写入全部行
for r in rows:
    ws.append(r)

# 单元格样式
last = ws.max_row
for i in range(3, last+1):
    batch = ws[i]  # keys 为1-based
    for c in range(1,9):
        cell = batch[c-1]
        cell.font = body_font
        cell.border = border
        cell.alignment = al if c in (7,8) else ac
    # L1/L2 按技术/管理着色标记在标题即可，这里统一
    if ws.cell(i,2).value == '管理类':
        for c in range(1,9):
            ws.cell(i,c).fill = admin_fill
    else:
        for c in range(1,9):
            ws.cell(i,c).fill = skill_fill

# 合并 L1/L2/L3 相同值的连续块
# rows 已排序，第 index 行对应 Excel 行号 3+index
i = 0
while i < len(rows):
    j = i
    while j+1 < len(rows) and key3(rows[j+1])==key3(rows[i]):
        j += 1
    srow = 3 + i
    erow = 3 + j
    for col in (1,2,3):
        if erow > srow:
            ws.merge_cells(start_row=srow, start_column=col, end_row=erow, end_column=col)
    i = j + 1

# 表头样式
ws.cell(1,1).font = title_font
ws.cell(1,1).alignment = Alignment(horizontal='center', vertical='center')
ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=8)
for c in range(1,9):
    cell = ws.cell(2,c)
    cell.font = head_font
    cell.fill = head_fill
    cell.alignment = ac
    cell.border = border

widths = [11,10,16,16,30,9,40,40]
for i,w in enumerate(widths,1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.freeze_panes = 'A3'

wb.save(OUT)
print('已保存:', OUT)
print('合并的非星图L3行数:', n_merge)
l3set = OrderedDict()
for r in rows:
    l3set.setdefault((r[0],r[1],r[2]), 0); l3set[(r[0],r[1],r[2])] += 1
print('L3 方向数:', len(l3set))
for k,v in l3set.items(): print('  ', k[0], k[1], k[2], '=', v, '行')
print('L5 细分总数:', len(rows))
print('来源统计:', dict(Counter(r[5] for r in rows)))