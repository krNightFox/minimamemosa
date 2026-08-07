import { test, expect, Page } from '@playwright/test';

test.describe('Notes & UI Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app');
  });

  async function waitForTiptap(page: Page): Promise<void> {
    await page.waitForFunction(() => {
      const ed = (window as any).tiptapEditor;
      return ed && typeof ed.commands === 'object';
    });
  }

  async function typeInEditor(page: Page, text: string): Promise<void> {
    await page.locator('.ProseMirror').first().focus();
    await page.keyboard.type(text, { delay: 20 });
  }

  async function createNote(page: Page, text: string): Promise<void> {
    await waitForTiptap(page);
    await typeInEditor(page, text);
    await expect(page.locator('#save-memo-btn')).toBeEnabled();
    await page.click('#save-memo-btn');
    await page.waitForTimeout(1000);
  }

  test('should display the timeline view with editor and save button', async ({ page }) => {
    await waitForTiptap(page);
    await expect(page.locator('#memo-form')).toBeVisible();
    await expect(page.locator('#save-memo-btn')).toBeVisible();
    await expect(page.locator('[href="/logout"]')).toBeVisible();
  });

  test('should create a new note', async ({ page }) => {
    await createNote(page, 'Hello from E2E test');
    await expect(page.locator('#timeline').getByText('Hello from E2E test')).toBeVisible();
  });

  test('should wrap extremely long words without overflowing', async ({ page }) => {
    const longWord = 'a'.repeat(150);
    await createNote(page, longWord);

    const memoContent = page.locator('#timeline [id^="memo-"] .memo-content').first();
    await expect(memoContent).toBeVisible();
    await expect(memoContent).toContainText(longWord);
    
    // Check if the appropriate CSS properties are applied to handle long words
    await expect(memoContent).toHaveCSS('overflow-wrap', 'anywhere');
    await expect(memoContent).toHaveCSS('word-break', 'break-word');
    
    // Check bounding box to ensure it doesn't exceed the timeline width significantly
    const timeline = page.locator('#timeline');
    const timelineBox = await timeline.boundingBox();
    const contentBox = await memoContent.boundingBox();
    
    expect(contentBox!.width).toBeLessThanOrEqual(timelineBox!.width);
  });

  test('should toggle line wrap on code blocks in the note preview', async ({ page }) => {
    await waitForTiptap(page);
    await page.locator('.ProseMirror').first().focus();
    
    const longString = 'a'.repeat(200);
    const markdown = `Code block test:\n\`\`\`javascript\nconst longStr = "${longString}";\n\`\`\``;
    
    await page.evaluate((text) => {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const event = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      });
      document.querySelector('.ProseMirror')?.dispatchEvent(event);
    }, markdown);

    await expect(page.locator('#save-memo-btn')).toBeEnabled();
    await page.click('#save-memo-btn');
    await page.waitForTimeout(1000);

    const memoContent = page.locator('#timeline [id^="memo-"] .memo-content').first();
    await expect(memoContent).toBeVisible();

    const wrapper = memoContent.locator('.code-block-wrapper');
    await expect(wrapper).toBeVisible();

    const preBlock = wrapper.locator('pre');
    await expect(preBlock).toBeVisible();

    const wrapBtn = wrapper.locator('.code-wrap-btn');
    await expect(wrapBtn).toBeVisible();

    await expect(preBlock).not.toHaveClass(/code-wrapped/);

    await wrapper.hover();
    await wrapBtn.click();

    await expect(preBlock).toHaveClass(/code-wrapped/);

    await wrapBtn.click();

    await expect(preBlock).not.toHaveClass(/code-wrapped/);
  });

  test('should create a note with tags', async ({ page }) => {
    await createNote(page, 'This note has #rust and #testing tags');
    await expect(page.locator('#timeline').getByText('note has')).toBeVisible();
  });

  test('should open slash menu when typing / in the editor', async ({ page }) => {
    await waitForTiptap(page);
    await page.locator('.ProseMirror').first().focus();
    
    // Type slash to trigger the slash menu
    await page.keyboard.type('/');
    
    // Wait for the slash menu to become visible
    const slashMenu = page.locator('#slash-menu');
    await expect(slashMenu).toBeVisible();
    
    // Type 'h' to verify filtering works while menu is open
    await page.keyboard.type('h');
    // We expect the menu to still be visible and filtered
    await expect(slashMenu).toBeVisible();
    await expect(slashMenu.locator('button').first()).toBeVisible();
  });

  test('should parse markdown correctly on paste', async ({ page }) => {
    await waitForTiptap(page);
    await page.locator('.ProseMirror').first().focus();
    
    // Dispatch a paste event with markdown text
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', '### Subdomain Enumeration\\n```bash\\nsubfinder -d example.com\\n```');
      const event = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true
      });
      document.querySelector('.ProseMirror')?.dispatchEvent(event);
    });

    // Wait and verify HTML transformation
    const editor = page.locator('.ProseMirror').first();
    await expect(editor.locator('h3')).toHaveText('Subdomain Enumeration');
    await expect(editor.locator('pre code')).toHaveText('subfinder -d example.com');
  });

  test('should preserve line breaks with Shift+Enter', async ({ page }) => {
    await waitForTiptap(page);
    await page.locator('.ProseMirror').first().focus();
    await page.keyboard.type('Line 1');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Line 2');
    await expect(page.locator('#save-memo-btn')).toBeEnabled();
    await page.click('#save-memo-btn');
    await page.waitForTimeout(1000);

    const memoContent = page.locator('#timeline [id^="memo-"] .memo-content').first();
    await expect(memoContent).toBeVisible();
    const html = await memoContent.innerHTML();
    expect(html).toContain('Line 1<br>');
  });

  test('should preserve line breaks with Enter', async ({ page }) => {
    await waitForTiptap(page);
    await page.locator('.ProseMirror').first().focus();
    await page.keyboard.type('Paragraph 1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Paragraph 2');
    await expect(page.locator('#save-memo-btn')).toBeEnabled();
    await page.click('#save-memo-btn');
    await page.waitForTimeout(1000);

    const memoContent = page.locator('#timeline [id^="memo-"] .memo-content').first();
    await expect(memoContent).toBeVisible();
    const html = await memoContent.innerHTML();
    // Enter should create separate paragraph blocks or a line break
    expect(html).toContain('<p>Paragraph 1</p>');
    expect(html).toContain('<p>Paragraph 2</p>');
  });

  test('should preserve empty lines between paragraphs', async ({ page }) => {
    await waitForTiptap(page);
    await page.locator('.ProseMirror').first().focus();
    // Type: Line 1 [Enter] [Enter] Line 2 [Enter] [Enter] [Enter] Line 3
    await page.keyboard.type('Line 1');
    await page.keyboard.press('Enter');  // new paragraph (empty)
    await page.keyboard.press('Enter');  // another new paragraph
    await page.keyboard.type('Line 2');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Line 3');
    await expect(page.locator('#save-memo-btn')).toBeEnabled();
    await page.click('#save-memo-btn');
    await page.waitForTimeout(1000);

    const memoContent = page.locator('#timeline [id^="memo-"] .memo-content').first();
    await expect(memoContent).toBeVisible();
    const html = await memoContent.innerHTML();
    // All three lines must be present as separate paragraphs
    expect(html).toContain('<p>Line 1</p>');
    expect(html).toContain('<p>Line 2</p>');
    expect(html).toContain('<p>Line 3</p>');
    // Empty lines should be preserved as &nbsp; paragraphs (rendered as \u00a0 by pulldown_cmark)
    // Count the total number of <p> tags — should be more than 3 (the 3 text paragraphs + blank line paragraphs)
    const pCount = (html.match(/<p>/g) || []).length;
    expect(pCount).toBeGreaterThan(3);
  });

  test('should preserve multiple empty lines and editing', async ({ page }) => {
    await waitForTiptap(page);
    await page.locator('.ProseMirror').first().focus();
    
    await page.keyboard.type('Line 1');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Line 2');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Line 3');
    
    await expect(page.locator('#save-memo-btn')).toBeEnabled();
    await page.click('#save-memo-btn');
    await page.waitForTimeout(1000);

    let memoContent = page.locator('#timeline [id^="memo-"] .memo-content').first();
    await expect(memoContent).toBeVisible();
    let html = await memoContent.innerHTML();
    
    let pCount = (html.match(/<p>/g) || []).length;
    
    // Hover to reveal action buttons
    const memo = page.locator('#timeline [id^="memo-"]').first();
    await memo.hover();
    await memo.locator('button[onclick*="editMemo"]').click();

    await page.waitForFunction(() => {
      const ef = document.querySelector('[id^="memo-edit-form-"]');
      return ef && getComputedStyle(ef).display !== 'none';
    });
    await page.waitForTimeout(1500);

    const saveBtn = page.locator('[id^="save-memo-edit-btn-"]').first();
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();
    await page.waitForTimeout(1000);

    memoContent = page.locator('#timeline [id^="memo-"] .memo-content').first();
    await expect(memoContent).toBeVisible();
    html = await memoContent.innerHTML();
    
    let pCountAfterEdit = (html.match(/<p>/g) || []).length;
    expect(pCountAfterEdit).toEqual(pCount);
  });

  test('should preserve soft breaks with Shift+Enter', async ({ page }) => {
    await waitForTiptap(page);
    await page.locator('.ProseMirror').first().focus();
    
    await page.keyboard.type('Line 1');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('Line 2');
    
    await expect(page.locator('#save-memo-btn')).toBeEnabled();
    
    await page.click('#save-memo-btn');
    await page.waitForTimeout(1000);

    let memoContent = page.locator('#timeline [id^="memo-"] .memo-content').first();
    await expect(memoContent).toBeVisible();
    let html = await memoContent.innerHTML();
    
    // It should be within a single paragraph (or just normal markdown parsing), but must contain <br>
    expect(html).toContain('Line 1<br');
    expect(html).toContain('<br>Line 2');
    
    // Edit the note to verify it persists
    const memo = page.locator('#timeline [id^="memo-"]').first();
    await memo.hover();
    await memo.locator('button[onclick*="editMemo"]').click();

    await page.waitForFunction(() => {
      const ef = document.querySelector('[id^="memo-edit-form-"]');
      return ef && getComputedStyle(ef).display !== 'none';
    });
    await page.waitForTimeout(1500);

    const saveBtn = page.locator('[id^="save-memo-edit-btn-"]').first();
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();
    await page.waitForTimeout(1000);

    memoContent = page.locator('#timeline [id^="memo-"] .memo-content').first();
    await expect(memoContent).toBeVisible();
    html = await memoContent.innerHTML();
    
    expect(html).toContain('Line 1<br');
    expect(html).toContain('<br>Line 2');
  });

  test('should preserve newlines when editing a note', async ({ page }) => {
    await waitForTiptap(page);
    await page.locator('.ProseMirror').first().focus();
    await page.keyboard.type('Line 1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Line 2');
    await expect(page.locator('#save-memo-btn')).toBeEnabled();
    await page.click('#save-memo-btn');
    await page.waitForTimeout(1000);

    // Hover to reveal action buttons
    const memo = page.locator('#timeline [id^="memo-"]').first();
    await memo.hover();

    // Click edit
    await memo.locator('button[onclick*="editMemo"]').click();

    // Wait for edit form to load
    await page.waitForFunction(() => {
      const ef = document.querySelector('[id^="memo-edit-form-"]');
      return ef && getComputedStyle(ef).display !== 'none';
    });

    await page.waitForTimeout(1500);

    // Click Save on edit form without modifying
    const saveBtn = page.locator('[id^="save-memo-edit-btn-"]').first();
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();
    await page.waitForTimeout(1000);

    const memoContent = page.locator('#timeline [id^="memo-"] .memo-content').first();
    await expect(memoContent).toBeVisible();
    const html = await memoContent.innerHTML();
    expect(html).toContain('<p>Line 1</p>');
    expect(html).toContain('<p>Line 2</p>');
  });

  test('should edit an existing note', async ({ page }) => {
    await createNote(page, 'Original content for edit test');

    // Hover to reveal action buttons
    const memo = page.locator('#timeline [id^="memo-"]').first();
    await memo.hover();

    // Click edit
    await memo.locator('button[onclick*="editMemo"]').click();

    // Wait for edit form to load with its own editor
    await page.waitForFunction(() => {
      const ef = document.querySelector('[id^="memo-edit-form-"]');
      return ef && getComputedStyle(ef).display !== 'none';
    });

    // Give Tiptap time to init inside the edit form
    await page.waitForTimeout(1500);

    // Edit the content by clearing and retyping
    await waitForTiptap(page);
    const proseMirrors = page.locator('.ProseMirror');
    const count = await proseMirrors.count();
    // If there are multiple editors, pick the one in the edit form
    if (count > 1) {
      await proseMirrors.nth(count - 1).focus();
    } else {
      await proseMirrors.first().focus();
    }
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Edited content for verification', { delay: 15 });

    await page.waitForTimeout(500);

    // Click Save on edit form
    const saveBtn = page.locator('[id^="save-memo-edit-btn-"]').first();
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();
    await page.waitForTimeout(1000);

    await expect(page.locator('#timeline').getByText('Edited content for verification')).toBeVisible();
  });

  test('should open emoji picker and insert an emoji', async ({ page }) => {
    await waitForTiptap(page);

    await page.locator('button[onclick*="toggleEmojiPicker"]').first().click();
    await expect(page.locator('#emoji-picker')).toBeVisible();

    const grid = page.locator('#emoji-grid');
    await expect(grid).toBeVisible();
    const count = await grid.locator('button').count();
    expect(count).toBeGreaterThan(0);

    await grid.locator('button').first().click();
    await expect(page.locator('#emoji-picker')).not.toBeVisible();

    await page.click('#save-memo-btn');
    await page.waitForTimeout(1000);
  });

  test('should open plus menu with all options', async ({ page }) => {
    await waitForTiptap(page);

    await page.locator('button[onclick*="togglePlusMenu"]').first().click();
    await expect(page.locator('#plus-menu')).toBeVisible();
    await expect(page.locator('#plus-menu')).toContainText('Upload Image');
    await expect(page.locator('#plus-menu')).toContainText('Upload File');
    await expect(page.locator('#plus-menu')).toContainText('Record Audio');
    await expect(page.locator('#plus-menu')).toContainText('Link Note');

    await page.locator('.ProseMirror').first().click({ force: true });
    await expect(page.locator('#plus-menu')).not.toBeVisible();
  });

  test('should change note visibility to public', async ({ page }) => {
    await waitForTiptap(page);

    await page.locator('#memo-form button[onclick*="toggleVisDropdown"]').first().click();
    await expect(page.locator('#memo-form .vis-dropdown-menu')).toBeVisible();
    await page.locator('#memo-form button[data-vis-value="public"]').click();
    await expect(page.locator('#memo-form .vis-label')).not.toContainText('Private');
  });

  test('should change note visibility to protected with password', async ({ page }) => {
    await waitForTiptap(page);

    await page.locator('#memo-form button[onclick*="toggleVisDropdown"]').first().click();
    await page.locator('#memo-form button[data-vis-value="protected"]').click();
    await expect(page.locator('#vis-password-modal')).toBeVisible();
    await expect(page.locator('#vis-pwd-title')).toContainText('Password');

    await page.fill('#vis-pwd-input', 'mypassword');
    await page.fill('#vis-pwd-confirm', 'mypassword');
    await page.locator('button[onclick*="confirmVisPwd"]').click();
    await expect(page.locator('#vis-password-modal')).not.toBeVisible();
  });

  test('should toggle dark mode', async ({ page }) => {
    await waitForTiptap(page);

    const before = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );

    await page.locator('header button[onclick*="toggleTheme"]').click();
    const after = await page.evaluate(() =>
      document.documentElement.classList.contains('dark'),
    );
    expect(after).toBe(!before);

    // restore
    await page.locator('header button[onclick*="toggleTheme"]').click();
  });

  test('should open settings modal and select accent theme', async ({ page }) => {
    await waitForTiptap(page);

    await page.locator('button[onclick*="openSettings"]').first().click();
    await expect(page.locator('#settings-modal')).toBeVisible();
    await expect(page.locator('#settings-theme-list')).toBeVisible();
    await expect(page.locator('#settings-theme-list')).toContainText('Default');
    await expect(page.locator('#settings-theme-list')).toContainText('Rose');

    await page.locator('#settings-theme-list [data-theme="Forest"]').click();
    await page.locator('button[onclick*="saveTheme"]').click();
    await expect(page.locator('#settings-modal')).not.toBeVisible();
  });

  test('should delete a note', async ({ page }) => {
    await createNote(page, 'Note to be deleted');

    // Hover to reveal buttons
    const memo = page.locator('#timeline [id^="memo-"]').first();
    await memo.hover();

    let dialogHandled = false;
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Delete');
      await dialog.accept();
      dialogHandled = true;
    });

    await memo.locator('button[onclick*="deleteMemo"]').click();
    await page.waitForTimeout(1500);
    expect(dialogHandled).toBe(true);
  });

  test('should switch to notes panel', async ({ page }) => {
    await createNote(page, 'Note in notes panel');

    await page.click('#icon-notes');
    await page.waitForURL(/\/app\/?$/);

    await expect(page.locator('#unified-sidebar')).toBeVisible();
    await expect(page.locator('#unified-sidebar-content')).toContainText('Notes');
  });

  test('should switch to resources panel', async ({ page }) => {
    await waitForTiptap(page);

    await page.click('#icon-resources');
    await page.waitForURL(/\/app\/resources/);

    await expect(page.locator('#resources-panel')).toBeVisible();
    await expect(page.locator('#resources-panel')).toContainText('Resources');
  });

  test('should show avatar with user initial', async ({ page }) => {
    await waitForTiptap(page);
    await expect(page.locator('.avatar-initials').first()).toContainText('E');
  });

  test('should see timeline date group labels', async ({ page }) => {
    await createNote(page, 'Note for date label test');
    await expect(page.locator('#timeline .uppercase').first()).toBeVisible();
  });

  test('should see the sidebar with search', async ({ page }) => {
    await createNote(page, 'Sidebar test note');

    await page.click('#icon-notes');
    await page.waitForURL(/\/app\/?$/);

    await expect(page.locator('#unified-sidebar-content input[placeholder*="Search"]')).toBeVisible();
  });

  test('should insert text above and below image when clicking on margins', async ({ page }) => {
    await waitForTiptap(page);

    // 1. Insert an image programmatically using a 1x1 pixel data URI
    await page.evaluate(() => {
      (window as any).tiptapEditor.commands.insertContent('<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" style="width: 200px; height: 150px;" />');
    });

    const img = page.locator('.ProseMirror img').first();
    await expect(img).toBeVisible();

    const box = await img.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // 2. Click left side of the image
      await page.mouse.click(box.x - 20, box.y + box.height / 2);
      
      // Type "Text Above"
      await page.keyboard.type('Text Above', { delay: 10 });
      
      // Verify that the paragraph before the image has "Text Above"
      const content = await page.locator('.ProseMirror').first().innerHTML();
      expect(content).toContain('<p>Text Above</p>');

      // 3. Click right side of the image
      await page.mouse.click(box.x + box.width + 20, box.y + box.height / 2);

      // Type "Text Below"
      await page.keyboard.type('Text Below', { delay: 10 });

      // Verify that the paragraph after the image has "Text Below"
      const content2 = await page.locator('.ProseMirror').first().innerHTML();
      expect(content2).toContain('<p>Text Below</p>');
    }
  });

  test('should open slash menu when editing a filtered note', async ({ page }) => {
    // 1. Create a note with specific content
    const noteTitle = 'Filtered Note for Slash Command Test';
    await createNote(page, noteTitle);

    // 2. Click the notes panel to ensure sidebar is visible
    await page.click('#icon-notes');
    await page.waitForURL(/\/app\/?$/);

    // 3. Search for the note in the sidebar
    const searchInput = page.locator('#sidebar-search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Slash Command Test');

    // 4. Wait for the note to appear in the sidebar
    const sidebarNote = page.locator(`#unified-sidebar-content div[data-title="${noteTitle}"]`);
    await expect(sidebarNote).toBeVisible();
    await sidebarNote.click();

    // 5. Wait for the note detail to open in the timeline
    const timelineNote = page.locator('#timeline [id^="memo-"]').first();
    await expect(timelineNote).toBeVisible();
    await expect(timelineNote.locator('.memo-content')).toContainText(noteTitle);

    // 6. Click edit on the note
    await timelineNote.hover();
    await timelineNote.locator('button[onclick*="editMemo"]').click();

    // 7. Wait for the edit form and Tiptap to initialize
    await page.waitForFunction(() => {
      const ef = document.querySelector('[id^="memo-edit-form-"]');
      return ef && getComputedStyle(ef).display !== 'none';
    });
    await waitForTiptap(page);

    // 8. Type slash inside the edit form
    const editEditor = page.locator('.memo-edit .ProseMirror').first();
    await editEditor.focus();
    // Press End to go to the end of the line
    await page.keyboard.press('End');
    // Add a space and a slash
    await page.keyboard.type(' /');

    // 9. Verify slash menu opens
    const slashMenu = page.locator('#slash-menu');
    await expect(slashMenu).toBeVisible();
    await expect(slashMenu.locator('button').first()).toBeVisible();
  });
});
