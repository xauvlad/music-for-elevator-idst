import { useMemo, useState } from 'react';
import { bonusLink, channelUrl, codeWord, floors, type Floor } from './data/floors';

type Screen = 'gate' | 'home' | 'floor' | 'code';

function App() {
  const [screen, setScreen] = useState<Screen>('gate');
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [doorsClosed, setDoorsClosed] = useState(false);
  const [word, setWord] = useState('');
  const [wordAccepted, setWordAccepted] = useState(false);
  const [wordError, setWordError] = useState('');

  const title = useMemo(() => {
    if (screen === 'floor' && selectedFloor) return `ЭТАЖ ${selectedFloor.id}`;
    if (screen === 'code') return 'КОДОВОЕ СЛОВО';
    if (screen === 'home') return 'ВЫБЕРИТЕ ЭТАЖ';
    return 'ПРОВЕРКА ДОСТУПА';
  }, [screen, selectedFloor]);

  const withDoorTransition = (action: () => void) => {
    setDoorsClosed(true);
    window.setTimeout(() => {
      action();
      setDoorsClosed(false);
    }, 500);
  };

  const handleFakeSubscriptionCheck = () => {
    setSubscribed(true);
    withDoorTransition(() => setScreen('home'));
  };

  const openFloor = (floor: Floor) => {
    withDoorTransition(() => {
      setSelectedFloor(floor);
      setScreen('floor');
    });
  };

  const goHome = () => {
    withDoorTransition(() => {
      setSelectedFloor(null);
      setScreen('home');
      setWord('');
      setWordAccepted(false);
      setWordError('');
    });
  };

  const openCodeScreen = () => {
    withDoorTransition(() => {
      setWord('');
      setWordAccepted(false);
      setWordError('');
      setScreen('code');
    });
  };

  const checkWord = () => {
    if (word.trim().toLowerCase() === codeWord.toLowerCase()) {
      setWordAccepted(true);
      setWordError('');
      return;
    }

    setWordAccepted(false);
    setWordError('Лифт не распознал команду. Попробуйте ещё раз.');
  };

  return (
    <div className="app-shell">
      <div className="elevator-frame">
        <header className="display-panel">
          <div className="brand">idst — Музыка для лифта</div>
          <div className="display">{title}</div>
        </header>

        <main className="elevator-stage">
          <div className={`doors ${doorsClosed ? 'closed' : 'open'}`} aria-hidden="true">
            <div className="door left" />
            <div className="door right" />
          </div>

          <section className="screen-content">
            {screen === 'gate' && (
              <div className="screen-block center-block">
                <p className="lead">
                  Чтобы подняться выше, подпишитесь на канал группы idst.
                </p>
                <div className="stack gap-md">
                  <a className="wide-button secondary" href={channelUrl} target="_blank" rel="noreferrer">
                    Подписаться на канал
                  </a>
                  <button className="wide-button" onClick={handleFakeSubscriptionCheck}>
                    Проверить подписку
                  </button>
                </div>
                <p className="hint">
                  Сейчас это демо-версия: кнопка проверки ведёт дальше без реальной проверки.
                </p>
              </div>
            )}

            {screen === 'home' && (
              <div className="screen-block home-screen">
                <div className="elevator-panel">
                  <div className="panel-display">ВЫБЕРИТЕ ЭТАЖ</div>

                  <div className="panel-buttons">
                    {floors.map((floor) => (
                      <button
                        key={floor.id}
                        className="elevator-btn"
                        onClick={() => openFloor(floor)}
                        aria-label={`Этаж ${floor.id}: ${floor.title}`}
                        title={floor.title}
                      >
                        {floor.id}
                      </button>
                    ))}
                  </div>

                  <button className="code-elevator-btn" onClick={openCodeScreen}>
                    КОДОВОЕ СЛОВО
                  </button>
                </div>

                <p className="hint home-hint">
                  Пассажиры, не осуществившие выбор, будут автоматически доставлены на последний этаж.
                </p>
              </div>
            )}

            {screen === 'floor' && selectedFloor && (
              <div className="screen-block floor-screen">
                <div className="floor-card">
                  <img src={selectedFloor.image} alt={selectedFloor.title} className="floor-image" />
                  <div className="floor-copy">
                    <div className="floor-badge">Этаж {selectedFloor.id}</div>
                    <h1>{selectedFloor.title}</h1>
                    <p>{selectedFloor.description}</p>
                    <div className="floor-actions">
                      <a className="wide-button" href={selectedFloor.musicUrl} target="_blank" rel="noreferrer">
                        Слушать на Яндекс Музыке
                      </a>
                      <button className="wide-button secondary" onClick={goHome}>
                        Назад
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {screen === 'code' && (
              <div className="screen-block center-block code-screen">
                <p className="lead">
                  Введите кодовое слово, чтобы открыть бонус-трек.
                </p>

                <label className="code-input-wrap">
                  <span>Кодовое слово</span>
                  <input
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    placeholder="Введите слово"
                    className="code-input"
                  />
                </label>

                <div className="stack gap-md">
                  <button className="wide-button" onClick={checkWord}>
                    Проверить
                  </button>
                  <button className="wide-button secondary" onClick={goHome}>
                    Назад
                  </button>
                </div>

                {wordAccepted && (
                  <div className="result-box success">
                    <p>Код принят. Допуск открыт.</p>
                    <a className="wide-button" href={bonusLink} target="_blank" rel="noreferrer">
                      Получить бонус-трек
                    </a>
                  </div>
                )}

                {!wordAccepted && wordError && <div className="result-box error">{wordError}</div>}
              </div>
            )}
          </section>
        </main>

        <footer className="footer-bar">
          <span>demo mode</span>
          <span>{subscribed ? 'доступ открыт' : 'ожидание проверки'}</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
