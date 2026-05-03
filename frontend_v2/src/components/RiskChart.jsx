import React from 'react';

const RiskChart = ({ score = 0 }) => {
  // score가 null, undefined이거나 숫자가 아닐 경우 0으로 처리
  const validScore = typeof score === 'number' && !isNaN(score) ? Math.min(Math.max(score, 0), 1) : 0;
  
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  
  // strokeDashoffset 계산 시 안전한 값 보장
  const offset = circumference - (validScore * circumference);
  
  // 색상 판정
  const getColor = (s) => {
    if (s <= 0.25) return '#10b981'; // Low - Green
    if (s <= 0.50) return '#f59e0b'; // Moderate - Yellow
    return '#ef4444'; // Critical - Red
  };

  const getLabel = (s) => {
    if (s <= 0.25) return 'Low';
    if (s <= 0.50) return 'Moderate';
    return 'Critical';
  };

  const color = getColor(validScore);

  return (
    <div className="relative flex items-center justify-center w-48 h-48">
      <svg className="w-full h-full transform -rotate-90">
        <circle 
          cx="96" 
          cy="96" 
          r={radius} 
          stroke="#e5e7eb" 
          strokeWidth="12" 
          fill="transparent" 
        />
        <circle
          cx="96"
          cy="96"
          r={radius}
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          // 계산된 offset이 유효한 숫자인지 최종 확인
          strokeDashoffset={isNaN(offset) ? circumference : offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center transform rotate-0">
        <span className="text-4xl font-black" style={{ color }}>
          {(validScore * 100).toFixed(0)}%
        </span>
        <span className="text-sm font-bold uppercase tracking-wider mt-1" style={{ color }}>
          {getLabel(validScore)}
        </span>
      </div>
    </div>
  );
};

export default RiskChart;