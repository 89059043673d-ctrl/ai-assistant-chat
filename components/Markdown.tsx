{c.messages[c.messages.length - 1]?.content  'Пусто'}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-subtext pt-2 border-t border-border">
            <List size={16} /> Все чаты
          </div>
        </div>
      </aside>

      {/* Основная панель */}
      <main className={mainClasses}>
        {/* Верхняя линия (всегда на всю ширину) */}
        <header className="safe-top flex items-center gap-2 px-4 py-3 border-b border-border">
          <button
            className="p-2 rounded hover:bg-panelAlt"
            onClick={() => setSidebarOpen((s) => !s)}
            title="Меню"
            aria-label="Меню"
          >
            <Menu size={18} />
          </button>
          <h1 className="text-lg font-semibold">AI Assistant Chat</h1>
        </header>

        {/* Сообщения: отдельная прокрутка, нижний паддинг = высоте композитора */}
        <div
          className="flex-1 overflow-y-auto p-4"
          style={{ paddingBottom: composerH + 16 }} // +16px запас
        >
          {/* Приветственный экран */}
          {showGreeting && (
            <div className="max-w-3xl mx-auto mt-10 text-center animate-fadeIn">
              <h2 className="text-3xl font-semibold mb-2">Здравствуйте, чем могу помочь сегодня?</h2>
              <p className="text-subtext">Введите вопрос ниже — и начнём.</p>
            </div>
          )}

          {/* Сообщения */}
          <div className="max-w-3xl mx-auto">
            {currentChat?.messages.map((m, i) => (
              <div key={i} className={clsx('group mb-4 max-w-3xl', m.role === 'user' && 'ml-auto')}>
                <div className={clsx('msg', m.role === 'user' ? 'msg-user' : 'msg-assistant')}>
                  {m.role === 'assistant' ? (
                    <Markdown>{m.content}</Markdown>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
                <div className="msg-actions flex items-center gap-3">
                  <button
                    className="inline-flex items-center gap-1 hover:text-zinc-200"
                    onClick={() => copyToClipboard(m.content)}
                    title="Скопировать"
                    aria-label="Скопировать сообщение"
                  >
                    <Copy size={14} /> Скопировать
                  </button>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      </main>

      {/* НИЖНЯЯ ПАНЕЛЬ: ФИКСИРОВАНА СНИЗУ (не двигается и не исчезает) */}
      <div
        ref={composerRef}
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-panel"
      >
        <div className="max-w-3xl mx-auto p-3">
          <div className="flex items-end gap-2">
            <button
              className={clsx('icon-btn', recOn && 'bg-panelAlt')}
              onClick={toggleRec}
              title="Микрофон"
              aria-label="Микрофон"
            >
              <Mic size={18} />
            </button>
            <button className="icon-btn" title="Прикрепить" aria-label="Прикрепить">
              <Paperclip size={18} />
            </button>

            <div className="flex-1">
              <textarea
                ref={textareaRef}
                className="w-full max-h-52 resize-none rounded-xl border border-border bg-panelAlt p-3 outline-none focus:ring-1 focus:ring-zinc-600"
                rows={1}
                placeholder="Напишите сообщение…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>

            <button
              className="p-3 rounded-xl bg-zinc-200 text-zinc-900 hover:opacity-90 disabled:opacity-50 transition-opacity"
              onClick={sendMessage}
              disabled={sending  !input.trim()}
              title="Отправить"
              aria-label="Отправить"
