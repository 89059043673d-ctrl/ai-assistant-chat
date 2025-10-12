>
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ---------- helpers ----------
  async function copyToClipboard(content: string) {
    try { await navigator.clipboard.writeText(content); } catch {}
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  }

  function emptyChat(): Chat {
    return { id: genId(), title: 'Новый чат', messages: [], updatedAt: Date.now() };
  }
}

async function safeText(res: Response) {
  try { return await res.text(); } catch { return ''; }
}
