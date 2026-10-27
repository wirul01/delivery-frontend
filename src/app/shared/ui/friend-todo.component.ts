import { Component, input } from '@angular/core';

/**
 * กล่อง "งานของเพื่อนคนที่ 2" — ใช้เป็นที่กั้นหน้าที่ยังไม่ได้ทำ
 * เพื่อนลบ <app-friend-todo> ออกจากหน้าของตัวเองเมื่อเขียนหน้าจริงเสร็จ
 */
@Component({
  selector: 'app-friend-todo',
  template: `
    <section class="page">
      <header class="page-head">
        <div><h1>{{ title() }}</h1><p>ส่วนนี้เป็นงานของเพื่อนคนที่ 2 (ฝั่งเส้นทางและไรเดอร์)</p></div>
        <span class="badge badge-plain">รอเพื่อนเขียน</span>
      </header>
      <div class="panel panel-pad todo">
        <h2>สิ่งที่หน้านี้ต้องมี</h2>
        <ul>@for (t of tasks(); track t) { <li>{{ t }}</li> }</ul>
        <p class="hint">ดูตัวอย่างโค้ดและ API ที่เรียกใช้ได้ในคอมเมนต์ของไฟล์ .ts ของหน้านี้</p>
      </div>
    </section>
  `,
  styles: `
    .todo { border-style: dashed; display: grid; gap: 10px; }
    ul { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
  `,
})
export class FriendTodoComponent {
  title = input.required<string>();
  tasks = input.required<string[]>();
}
