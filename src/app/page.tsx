"use client";

import React, { useState, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  RotateCcw,
  Home as HomeIcon,
  Timer,
  Trophy,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface FruitItem {
  name: string;
  emoji: string;
  color: string;
  bgLight: string;
}

const FRUITS: FruitItem[] = [
  { name: "사과", emoji: "🍎", color: "text-red-500", bgLight: "bg-red-50 hover:bg-red-100" },
  { name: "바나나", emoji: "🍌", color: "text-yellow-500", bgLight: "bg-yellow-50 hover:bg-yellow-100" },
  { name: "포도", emoji: "🍇", color: "text-purple-500", bgLight: "bg-purple-50 hover:bg-purple-100" },
  { name: "수박", emoji: "🍉", color: "text-emerald-500", bgLight: "bg-emerald-50 hover:bg-emerald-100" },
  { name: "오렌지", emoji: "🍊", color: "text-orange-500", bgLight: "bg-orange-50 hover:bg-orange-100" },
  { name: "딸기", emoji: "🍓", color: "text-rose-500", bgLight: "bg-rose-50 hover:bg-rose-100" },
  { name: "체리", emoji: "🍒", color: "text-pink-500", bgLight: "bg-pink-50 hover:bg-pink-100" },
  { name: "복숭아", emoji: "🍑", color: "text-amber-500", bgLight: "bg-amber-50 hover:bg-amber-100" },
];

interface CardState {
  id: number;
  fruit: FruitItem;
  isFlipped: boolean;
  isMatched: boolean;
}

interface LeaderboardItem {
  rank?: number;
  name: string;
  score: number;
  finishtime: string;
}

export default function MemoryGamePage() {
  const [userName, setUserName] = useState<string>("");
  const [inputName, setInputName] = useState<string>("");
  const [gameState, setGameState] = useState<"lobby" | "ready" | "playing" | "paused" | "completed">("lobby");

  const [cards, setCards] = useState<CardState[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [matchedPairs, setMatchedPairs] = useState<number>(0);
  const [attempts, setAttempts] = useState<number>(0);

  // 구글 시트 저장 상태
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string>("");

  // TOP 3 랭킹 데이터 및 로딩 상태
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 초를 mm:ss 형식으로 변환
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 타이머 효과
  useEffect(() => {
    if (gameState === "playing") {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameState]);

  // 카드 덱 생성 및 섞기
  const generateDeck = (): CardState[] => {
    const deckFruits = [...FRUITS, ...FRUITS];
    const shuffled = [...deckFruits].sort(() => Math.random() - 0.5);
    return shuffled.map((fruit, index) => ({
      id: index,
      fruit,
      isFlipped: false,
      isMatched: false,
    }));
  };

  const hasSavedRef = useRef<boolean>(false);

  // TOP 3 랭킹 가져오기
  const fetchLeaderboard = async () => {
    const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
    if (!scriptUrl) return;

    setIsLoadingLeaderboard(true);
    try {
      const res = await fetch(`${scriptUrl}?action=getLeaderboard&t=${Date.now()}`);
      const data = await res.json();
      if (data && data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
    } catch (err) {
      console.error("랭킹 조회 실패:", err);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  // 구글 스프레드시트에 게임 완료 데이터 저장
  const saveGameRecord = async (finalTime: number, finalAttempts: number) => {
    if (hasSavedRef.current) return;
    hasSavedRef.current = true;

    const scriptUrl = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;

    if (!scriptUrl) {
      console.warn("NEXT_PUBLIC_GOOGLE_SCRIPT_URL 이 .env.local 에 설정되지 않았습니다.");
      setSaveStatus("error");
      setSaveMessage(".env.local 에 구글 스크립트 배포 URL이 설정되지 않았습니다.");
      return;
    }

    setSaveStatus("saving");
    setSaveMessage("구글 시트에 기록을 저장하는 중입니다...");

    try {
      const payload = {
        name: userName,
        score: finalAttempts, // 시도 횟수를 score로 저장
        finishtime: formatTime(finalTime),
      };

      // Google Apps Script 웹 앱으로 데이터 전송 (no-cors)
      await fetch(scriptUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload),
      });

      setSaveStatus("success");
      setSaveMessage("구글 스프레드시트에 성공적으로 저장되었습니다!");

      // 데이터가 시트에 쓰여진 직후 TOP 3 랭킹 조회 (약간의 지연 후 갱신)
      setTimeout(() => {
        fetchLeaderboard();
      }, 1000);
    } catch (error) {
      console.error("구글 시트 저장 실패:", error);
      setSaveStatus("error");
      setSaveMessage("기록 저장 중 오류가 발생했습니다.");
    }
  };

  // 사용자 이름 제출
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    hasSavedRef.current = false;
    setUserName(inputName.trim());
    setCards(generateDeck());
    setGameState("ready");
    setSaveStatus("idle");
    setSaveMessage("");
    setLeaderboard([]);
  };

  // 게임 시작
  const handleStartGame = () => {
    hasSavedRef.current = false;
    setGameState("playing");
    setLeaderboard([]);
  };

  // 일시정지 및 재개
  const handleTogglePause = () => {
    if (gameState === "playing") {
      setGameState("paused");
    } else if (gameState === "paused") {
      setGameState("playing");
    }
  };

  // 다시 시작 (중간 포기 및 재시작 시에는 시트에 저장하지 않음)
  const handleRestart = () => {
    hasSavedRef.current = false;
    setCards(generateDeck());
    setFlippedIndices([]);
    setMatchedPairs(0);
    setAttempts(0);
    setElapsedTime(0);
    setIsProcessing(false);
    setSaveStatus("idle");
    setSaveMessage("");
    setGameState("playing");
  };

  // 처음으로 (중간 포기 시 시트에 저장하지 않음)
  const handleResetToLobby = () => {
    hasSavedRef.current = false;
    setGameState("lobby");
    setUserName("");
    setInputName("");
    setCards([]);
    setFlippedIndices([]);
    setMatchedPairs(0);
    setAttempts(0);
    setElapsedTime(0);
    setIsProcessing(false);
    setSaveStatus("idle");
    setSaveMessage("");
  };

  // 카드 클릭
  const handleCardClick = (index: number) => {
    if (
      gameState !== "playing" ||
      isProcessing ||
      cards[index].isFlipped ||
      cards[index].isMatched ||
      flippedIndices.includes(index)
    ) {
      return;
    }

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setIsProcessing(true);
      const currentAttempts = attempts + 1;
      setAttempts(currentAttempts);

      const [firstIdx, secondIdx] = newFlipped;
      if (cards[firstIdx].fruit.name === cards[secondIdx].fruit.name) {
        // 일치한 경우
        setTimeout(() => {
          setCards((prev) => {
            const updated = [...prev];
            updated[firstIdx].isMatched = true;
            updated[secondIdx].isMatched = true;
            return updated;
          });
          setFlippedIndices([]);
          setIsProcessing(false);

          const nextMatched = matchedPairs + 1;
          setMatchedPairs(nextMatched);

          if (nextMatched === FRUITS.length) {
            // 🏆 모든 짝을 맞추어 성공적으로 완료된 경우에만 구글 시트에 단 1회 저장
            setGameState("completed");
            confetti({
              particleCount: 120,
              spread: 70,
              origin: { y: 0.6 },
            });
            saveGameRecord(elapsedTime, currentAttempts);
          }
        }, 500);
      } else {
        // 일치하지 않은 경우
        setTimeout(() => {
          setCards((prev) => {
            const updated = [...prev];
            updated[firstIdx].isFlipped = false;
            updated[secondIdx].isFlipped = false;
            return updated;
          });
          setFlippedIndices([]);
          setIsProcessing(false);
        }, 900);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex flex-col items-center justify-center p-4 sm:p-6 text-foreground">
      {/* 1. 시작 화면: 사용자 이름 입력 */}
      {gameState === "lobby" && (
        <Card className="w-full max-w-md shadow-xl border-amber-200/60 bg-white/90 backdrop-blur-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-amber-400 to-rose-400 rounded-2xl flex items-center justify-center text-3xl shadow-md mb-2">
              🍎
            </div>
            <CardTitle className="text-2xl font-black text-amber-950">
              과일 카드 맞추기 게임
            </CardTitle>
            <CardDescription className="text-zinc-600">
              기억력을 테스트해보세요! 이름을 입력하고 게임을 시작하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleNameSubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-amber-600" />
                  플레이어 이름
                </label>
                <Input
                  type="text"
                  placeholder="이름이나 닉네임을 입력하세요"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="h-12 text-base border-amber-200 focus-visible:ring-amber-500"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={!inputName.trim()}
                className="w-full h-12 text-base font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all active:scale-95"
              >
                도전하기
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 2. 대기 및 플레이 화면 */}
      {gameState !== "lobby" && (
        <div className="w-full max-w-xl flex flex-col items-center gap-5">
          {/* 상단 컨트롤 및 상태 바 */}
          <div className="w-full bg-white/80 backdrop-blur-md rounded-2xl p-4 shadow-md border border-amber-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-lg shadow-inner">
                {userName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="text-xs text-zinc-500 font-medium">플레이어</div>
                <div className="text-base font-bold text-zinc-800">{userName}</div>
              </div>
            </div>

            {/* 타이머 & 시도 횟수 */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-amber-50 px-3.5 py-1.5 rounded-xl border border-amber-200/60">
                <Timer className="w-4 h-4 text-amber-600 animate-pulse" />
                <span className="font-mono font-bold text-amber-900 text-lg">
                  {formatTime(elapsedTime)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-200/60 text-sm">
                <span className="text-orange-600 font-medium">매칭:</span>
                <span className="font-bold text-orange-950">
                  {matchedPairs} / {FRUITS.length}
                </span>
              </div>
            </div>

            {/* 컨트롤 버튼 모음 */}
            <div className="flex items-center gap-2">
              {gameState === "ready" && (
                <Button
                  onClick={handleStartGame}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 px-4 gap-1.5 shadow-sm"
                >
                  <Play className="w-4 h-4 fill-white" />
                  게임 시작
                </Button>
              )}

              {(gameState === "playing" || gameState === "paused") && (
                <Button
                  onClick={handleTogglePause}
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 gap-1 border-amber-300 text-amber-900 hover:bg-amber-100"
                >
                  {gameState === "paused" ? (
                    <>
                      <Play className="w-4 h-4 fill-current text-emerald-600" />
                      재개
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 text-amber-600" />
                      일시정지
                    </>
                  )}
                </Button>
              )}

              <Button
                onClick={handleRestart}
                variant="outline"
                size="sm"
                className="h-9 px-3 gap-1 border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                title="다시 시작"
              >
                <RotateCcw className="w-4 h-4" />
                다시 시작
              </Button>

              <Button
                onClick={handleResetToLobby}
                variant="ghost"
                size="sm"
                className="h-9 px-2.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                title="처음으로"
              >
                <HomeIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 4x4 카드 그리드 영역 */}
          <div className="relative w-full max-w-[480px] aspect-square p-2 bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl border border-amber-100/80">
            {/* 준비 상태 가림막 */}
            {gameState === "ready" && (
              <div className="absolute inset-0 z-20 backdrop-blur-md bg-white/70 rounded-3xl flex flex-col items-center justify-center p-6 text-center gap-4">
                <Sparkles className="w-12 h-12 text-amber-500 animate-bounce" />
                <div>
                  <h3 className="text-xl font-bold text-zinc-800">준비되셨나요?</h3>
                  <p className="text-sm text-zinc-600 mt-1">
                    ‘게임 시작’ 버튼을 누르면 타이머가 동작합니다.
                  </p>
                </div>
                <Button
                  size="lg"
                  onClick={handleStartGame}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-8 shadow-lg active:scale-95"
                >
                  <Play className="w-5 h-5 fill-white mr-1.5" />
                  게임 시작
                </Button>
              </div>
            )}

            {/* 일시정지 가림막 */}
            {gameState === "paused" && (
              <div className="absolute inset-0 z-20 backdrop-blur-md bg-zinc-900/60 rounded-3xl flex flex-col items-center justify-center p-6 text-center gap-4 text-white">
                <Pause className="w-12 h-12 text-amber-400" />
                <div>
                  <h3 className="text-2xl font-bold">게임이 일시정지되었습니다</h3>
                  <p className="text-sm text-zinc-300 mt-1">계속하려면 재개 버튼을 누르세요.</p>
                </div>
                <Button
                  onClick={handleTogglePause}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 shadow-md"
                >
                  <Play className="w-4 h-4 fill-white mr-1.5" />
                  계속하기
                </Button>
              </div>
            )}

            {/* 4x4 그리드 카드 */}
            <div className="grid grid-cols-4 grid-rows-4 gap-2.5 sm:gap-3 w-full h-full">
              {cards.map((card, index) => {
                const isOpen = card.isFlipped || card.isMatched;
                return (
                  <button
                    key={card.id}
                    onClick={() => handleCardClick(index)}
                    disabled={gameState !== "playing" || isOpen}
                    className={`relative w-full h-full rounded-2xl transition-all duration-300 flex items-center justify-center select-none shadow-sm cursor-pointer border ${
                      isOpen
                        ? `${card.fruit.bgLight} border-amber-200 scale-95`
                        : "bg-white hover:bg-amber-50/70 border-amber-200 hover:border-amber-400 active:scale-95 shadow-sm"
                    } ${card.isMatched ? "opacity-85 ring-2 ring-emerald-400/80" : ""}`}
                  >
                    {isOpen ? (
                      <div className="flex flex-col items-center justify-center animate-in fade-in zoom-in-75 duration-200">
                        <span className="text-3xl sm:text-4xl filter drop-shadow-sm">
                          {card.fruit.emoji}
                        </span>
                        <span className="text-[11px] font-semibold text-zinc-600 mt-0.5">
                          {card.fruit.name}
                        </span>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-400 font-bold text-sm">
                        ?
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. 게임 완료 카드 */}
          {gameState === "completed" && (
            <Card className="w-full max-w-md shadow-2xl border-emerald-300 bg-white/95 backdrop-blur-md animate-in zoom-in-95 duration-300">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg mb-2 text-white">
                  <Trophy className="w-8 h-8 fill-current text-yellow-300" />
                </div>
                <Badge className="mx-auto mb-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none font-semibold">
                  축하합니다! 미션 완료
                </Badge>
                <CardTitle className="text-2xl font-black text-zinc-900">
                  {userName} 님, 대단해요!
                </CardTitle>
                <CardDescription className="text-zinc-600">
                  모든 과일 카드 짝을 완벽하게 맞추셨습니다!
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 bg-zinc-50 p-4 rounded-xl border border-zinc-200/80 text-center">
                  <div>
                    <span className="text-xs text-zinc-500 font-medium">완료 시간</span>
                    <p className="text-2xl font-black text-emerald-600 mt-0.5">
                      {formatTime(elapsedTime)}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500 font-medium">시도 횟수</span>
                    <p className="text-2xl font-black text-zinc-800 mt-0.5">
                      {attempts}회
                    </p>
                  </div>
                </div>

                {/* 구글 시트 저장 알림 배너 */}
                <div
                  className={`p-3 rounded-xl text-xs sm:text-sm flex items-center gap-2 border ${
                    saveStatus === "saving"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : saveStatus === "success"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : saveStatus === "error"
                      ? "bg-rose-50 text-rose-800 border-rose-200"
                      : "bg-zinc-50 text-zinc-700 border-zinc-200"
                  }`}
                >
                  {saveStatus === "saving" && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-amber-600" />}
                  {saveStatus === "success" && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
                  {saveStatus === "error" && <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                  <span className="font-medium leading-tight">{saveMessage}</span>
                </div>

                {/* 🏆 TOP 3 명예의 전당 (종료시간 오름차순 랭킹) */}
                <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-600 fill-amber-500" />
                      명예의 전당 (TOP 3 최단 완료 순위)
                    </span>
                    {isLoadingLeaderboard && (
                      <span className="text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" /> 불러오는 중...
                      </span>
                    )}
                  </div>

                  {leaderboard.length > 0 ? (
                    <div className="space-y-1.5">
                      {leaderboard.map((item, idx) => {
                        const rankMedals = ["🥇", "🥈", "🥉"];
                        const isCurrent = item.name === userName;
                        return (
                          <div
                            key={idx}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                              isCurrent
                                ? "bg-amber-100/90 border border-amber-300 font-bold text-amber-950"
                                : "bg-white/80 border border-amber-100 text-zinc-800"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-base">{rankMedals[idx] || `${idx + 1}위`}</span>
                              <span>{item.name}</span>
                              {isCurrent && (
                                <Badge className="text-[10px] h-4 px-1.5 bg-amber-500 text-white hover:bg-amber-500">
                                  MY
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-zinc-500 text-xs">{item.score}회 시도</span>
                              <span className="font-mono font-bold text-amber-900">
                                {item.finishtime}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    !isLoadingLeaderboard && (
                      <div className="text-center py-2 text-xs text-zinc-500">
                        랭킹 정보를 불러오는 중입니다...
                      </div>
                    )
                  )}
                </div>

                <div className="flex gap-2.5 pt-1">
                  <Button
                    onClick={handleRestart}
                    className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" />
                    다시 도전하기
                  </Button>
                  <Button
                    onClick={handleResetToLobby}
                    variant="outline"
                    className="flex-1 h-11 border-zinc-300 hover:bg-zinc-100 font-semibold"
                  >
                    <HomeIcon className="w-4 h-4 mr-1.5" />
                    처음으로
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
