export interface PuzzleDefinition {
  scenarioId: number;
  type: string;
  description: string;
  instructions: string;
  hints: string[];
  data: any; // Role-specific details rendered in frontend
}

export class PuzzleService {
  /**
   * Generates a unique puzzle state for a given scenario session
   */
  public static generatePuzzle(scenarioId: number): PuzzleDefinition {
    switch (scenarioId) {
      case 1: // Bank Run -> Liquidity Balancing
        const targetOutflow = Math.floor(Math.random() * 40) + 80; // 80 - 120M
        return {
          scenarioId: 1,
          type: 'LIQUIDITY_FLOW',
          description: 'A major bank run is in progress. Capital is leaving at a rate of $X/sec. Channel our inflows to match and halt the outflow.',
          instructions: 'Set the flows on valves A, B, and C such that: (A * multiplierA) + (B * multiplierB) + (C * multiplierC) = TARGET OUTFLOW.',
          hints: [
            'Ask the Analyst for the valve multipliers.',
            'Ask the Risk Manager for individual valve flow limits.',
            'The sum of flows must exactly equal the Target Outflow.'
          ],
          data: {
            targetOutflow,
            multipliers: { A: 2, B: 3, C: 5 },
            limits: { A: 20, B: 30, C: 20 }
          }
        };

      case 2: // Margin Call -> Margin Optimization
        const marginRequired = Math.floor(Math.random() * 50) + 100; // 100 - 150M
        return {
          scenarioId: 2,
          type: 'MARGIN_OPTIMIZATION',
          description: 'Clearinghouse has issued a massive Margin Call due to a 30% drop in asset values. Post collateral using our remaining portfolio.',
          instructions: 'Allocate Cash, Gov Bonds, and Corp Bonds to meet the margin requirement while minimizing total portfolio cost. Each asset has a valuation haircut.',
          hints: [
            'Cash has 0% haircut (100% value).',
            'Gov Bonds have 15% haircut (85% valuation value).',
            'Corp Bonds have 40% haircut (60% valuation value) but we want to use them up if possible.',
            'The posted value: Cash + (GovBonds * 0.85) + (CorpBonds * 0.60) >= Margin Required.'
          ],
          data: {
            marginRequired,
            portfolio: {
              cash: 50,      // Max available
              govBonds: 80,  // Max available
              corpBonds: 100 // Max available
            },
            haircuts: {
              cash: 0,
              govBonds: 15,
              corpBonds: 40
            }
          }
        };

      case 3: // Market Freeze -> Bid-Ask Spread / Execution Rebalancer
        const liquidateAmount = Math.floor(Math.random() * 30) + 50; // 50 - 80M
        return {
          scenarioId: 3,
          type: 'ASSET_LIQUIDATION',
          description: 'Sovereign bond market is frozen. Standard sales fail. Distribute our massive liquidation block across multiple venues to avoid slippage.',
          instructions: 'Distribute the liquidation amount across: Lit Exchange, Dark Pool, and OTC Desk. Minimize total transaction fees.',
          hints: [
            'Lit Exchange has low spread (2%) but shallow depth (max $20M). Excess sales trigger 8% slippage.',
            'Dark Pool has higher spread (5%) and medium depth (max $40M). Excess sales trigger 12% slippage.',
            'OTC Desk has a flat 6% fee for any amount, with infinite depth.',
            'Balance the orders such that Lit + Dark + OTC = Liquidation Target.'
          ],
          data: {
            liquidateAmount,
            venues: {
              lit: { maxDepth: 20, baseFeePercent: 2, slippagePenaltyPercent: 8 },
              dark: { maxDepth: 40, baseFeePercent: 5, slippagePenaltyPercent: 12 },
              otc: { baseFeePercent: 6 }
            }
          }
        };

      case 4: // Counterparty Default -> Isolation Graph
        // Graph of banks and exposures. Players must cut credit limits to defaulted banks
        // but keeping connected viable banks active to preserve liquidity channels.
        return {
          scenarioId: 4,
          type: 'CREDIT_CONTAGION',
          description: 'A major dealer bank (Apex Credit) has defaulted. Restructure our risk lines to isolate the default contagion cascade.',
          instructions: 'Cut credit lines to distressed nodes (red/flashing) and purchase credit protection (CDS) on high-risk counterparties, while keeping healthy nodes active.',
          hints: [
            'Cut links to defaulting institutions IMMEDIATELY.',
            'Do not cut lines to AAA rated institutions; doing so triggers a liquidity channel penalty.',
            'The Risk Manager sees the rating, the Analyst sees default probabilities.'
          ],
          data: {
            defaultedNode: 'Apex Credit',
            nodes: [
              { name: 'Apex Credit', rating: 'DEFAULT', exposure: 80, defaultProbability: 100 },
              { name: 'Pacific Trust', rating: 'BB', exposure: 50, defaultProbability: 75, directExposureToDefaulted: true },
              { name: 'Sovereign Bank', rating: 'A', exposure: 40, defaultProbability: 30, directExposureToDefaulted: false },
              { name: 'Federal Union', rating: 'AAA', exposure: 20, defaultProbability: 2, directExposureToDefaulted: false },
              { name: 'Securities Corp', rating: 'B', exposure: 60, defaultProbability: 90, directExposureToDefaulted: true }
            ]
          }
        };

      case 5: // Systemic Financial Crash -> Fed repo Injection
        const currentLcr = 40; // Starts at 40% due to panic
        const netCashOutflow = 120; // 120M outflows
        // To restore LCR >= 100%, HQLA must be >= netCashOutflow (120M).
        // HQLA starts at 48M (48 / 120 = 40%). We need to inject at least 72M.
        // Emergency loan penalty is 8% per annum, max interest rate budget is $8M.
        // Therefore, maximum borrow allowed is $100M.
        const requiredLcr = 100;
        return {
          scenarioId: 5,
          type: 'FED_REPO_WINDOW',
          description: 'Systemic banking freeze. Our Liquidity Coverage Ratio (LCR) has collapsed to 40%. The Fed has opened the discount repo pump.',
          instructions: 'Draw liquidity from the Federal Reserve Discount window to restore LCR >= 100%, without exceeding our Interest Rate penalty budget.',
          hints: [
            'Ask the Treasury Manager for current HQLA ($48M) and Net Outflows ($120M).',
            'To get 100% LCR, HQLA must be equal to or greater than Net Outflows.',
            'Borrow amount + HQLA >= Net Outflow.',
            'Interest cost: Borrow Amount * 8%. Max budget is $8M (Max borrow is $100M).'
          ],
          data: {
            currentHqla: 48,
            netOutflow: 120,
            targetLcr: requiredLcr,
            penaltyRatePercent: 8,
            maxInterestBudget: 8
          }
        };

      default:
        throw new Error('Invalid scenario ID');
    }
  }

  /**
   * Validates if a submitted puzzle solution meets the constraints
   */
  public static verifySolution(scenarioId: number, solution: any, puzzleData: any): { success: boolean; message: string } {
    try {
      switch (scenarioId) {
        case 1: { // LIQUIDITY_FLOW
          const { A, B, C } = solution;
          if (A === undefined || B === undefined || C === undefined) {
            return { success: false, message: 'Invalid inputs. Ratios A, B, and C must be specified.' };
          }

          const target = puzzleData.targetOutflow;
          const mult = puzzleData.multipliers;
          const lim = puzzleData.limits;

          if (A < 0 || B < 0 || C < 0) {
            return { success: false, message: 'Flows cannot be negative.' };
          }
          if (A > lim.A || B > lim.B || C > lim.C) {
            return { success: false, message: `Flow valve capacities exceeded! (Max: A:${lim.A}, B:${lim.B}, C:${lim.C})` };
          }

          const sum = A * mult.A + B * mult.B + C * mult.C;
          if (sum === target) {
            return { success: true, message: 'Flow balanced! Outflow successfully neutralized.' };
          } else {
            return {
              success: false,
              message: `Imbalanced! Calculated input is $${sum}M, but target outflow is $${target}M. Offset: $${Math.abs(target - sum)}M.`
            };
          }
        }

        case 2: { // MARGIN_OPTIMIZATION
          const { cash, govBonds, corpBonds } = solution;
          if (cash === undefined || govBonds === undefined || corpBonds === undefined) {
            return { success: false, message: 'Incomplete collateral allocations.' };
          }

          const req = puzzleData.marginRequired;
          const portfolio = puzzleData.portfolio;

          if (cash < 0 || govBonds < 0 || corpBonds < 0) {
            return { success: false, message: 'Collateral allocations cannot be negative.' };
          }

          if (cash > portfolio.cash || govBonds > portfolio.govBonds || corpBonds > portfolio.corpBonds) {
            return { success: false, message: 'Allocation exceeds available asset balances.' };
          }

          // Calculate collateral value after haircuts
          // Cash: 0% haircut (1.0x value)
          // Gov Bonds: 15% haircut (0.85x value)
          // Corp Bonds: 40% haircut (0.6x value)
          const postedValue = cash * 1.0 + govBonds * 0.85 + corpBonds * 0.6;

          if (postedValue < req) {
            return {
              success: false,
              message: `Insufficient collateral! Posted value after haircuts is $${postedValue.toFixed(1)}M, but clearinghouse requires $${req}M.`
            };
          }

          return {
            success: true,
            message: `Margin call met! Posted collateral value of $${postedValue.toFixed(1)}M is verified.`
          };
        }

        case 3: { // ASSET_LIQUIDATION
          const { lit, dark, otc } = solution;
          if (lit === undefined || dark === undefined || otc === undefined) {
            return { success: false, message: 'All liquidation channels must be allocated.' };
          }

          const target = puzzleData.liquidateAmount;
          const venues = puzzleData.venues;

          if (lit < 0 || dark < 0 || otc < 0) {
            return { success: false, message: 'Allocations cannot be negative.' };
          }

          const totalAllocated = lit + dark + otc;
          if (totalAllocated !== target) {
            return {
              success: false,
              message: `Incorrect liquidation block size. Dispatched: $${totalAllocated}M, Target block: $${target}M.`
            };
          }

          // Calculate fees
          let litFee = lit * (venues.lit.baseFeePercent / 100);
          if (lit > venues.lit.maxDepth) {
            litFee += (lit - venues.lit.maxDepth) * (venues.lit.slippagePenaltyPercent / 100);
          }

          let darkFee = dark * (venues.dark.baseFeePercent / 100);
          if (dark > venues.dark.maxDepth) {
            darkFee += (dark - venues.dark.maxDepth) * (venues.dark.slippagePenaltyPercent / 100);
          }

          const otcFee = otc * (venues.otc.baseFeePercent / 100);
          const totalFee = litFee + darkFee + otcFee;

          // Max acceptable fee is 5.5% of target amount
          const maxAcceptableFee = target * 0.055;

          if (totalFee > maxAcceptableFee) {
            return {
              success: false,
              message: `Transaction costs too high! Total slippage & fees are $${totalFee.toFixed(2)}M, which exceeds our capital loss limit of $${maxAcceptableFee.toFixed(2)}M. Optimize allocations!`
            };
          }

          return {
            success: true,
            message: `Liquidation completed! Asset blocks traded with minimized transaction cost: $${totalFee.toFixed(2)}M.`
          };
        }

        case 4: { // CREDIT_CONTAGION
          // The solution should contain an array of isolated nodes and defended nodes
          // e.g. { cutLines: ['Apex Credit', 'Pacific Trust', 'Securities Corp'], buyCds: ['Securities Corp'] }
          const { cutLines, buyCds } = solution;
          if (!Array.isArray(cutLines) || !Array.isArray(buyCds)) {
            return { success: false, message: 'Invalid response format.' };
          }

          // Apex Credit must be cut (defaulted)
          if (!cutLines.includes('Apex Credit')) {
            return { success: false, message: 'Contagion alert: You did not terminate the credit line to Apex Credit (DEFAULTED)!' };
          }

          // Pacific Trust and Securities Corp have high probability of contagion default (Probability >= 75%)
          // They must either be cut or protected.
          // AAA node 'Federal Union' must NOT be cut.
          if (cutLines.includes('Federal Union')) {
            return { success: false, message: 'Credit error: Terminating lines to Federal Union (AAA-rated) caused a critical liquidity freeze!' };
          }

          if (!cutLines.includes('Pacific Trust')) {
            return { success: false, message: 'Domino alert: Pacific Trust defaulted due to exposure to Apex, causing a credit cascade!' };
          }

          const protectedSecurities = cutLines.includes('Securities Corp') || buyCds.includes('Securities Corp');
          if (!protectedSecurities) {
            return { success: false, message: 'Domino alert: Securities Corp default cascaded and wiped out our equity reserves!' };
          }

          return {
            success: true,
            message: 'Credit contagion successfully halted! Distressed counterparties isolated and credit buffers preserved.'
          };
        }

        case 5: { // FED_REPO_WINDOW
          const { borrowAmount } = solution;
          if (borrowAmount === undefined || typeof borrowAmount !== 'number') {
            return { success: false, message: 'Specify the borrowing amount.' };
          }

          const hqla = puzzleData.currentHqla;
          const outflow = puzzleData.netOutflow;
          const rate = puzzleData.penaltyRatePercent / 100;
          const budget = puzzleData.maxInterestBudget;

          if (borrowAmount < 0) {
            return { success: false, message: 'Borrow amount cannot be negative.' };
          }

          const endingHqla = hqla + borrowAmount;
          const endingLcr = (endingHqla / outflow) * 100;

          if (endingLcr < 100) {
            return {
              success: false,
              message: `Solvency failure! Drawing $${borrowAmount}M brings total HQLA to $${endingHqla}M, resulting in LCR of only ${endingLcr.toFixed(1)}%. We need LCR >= 100%.`
            };
          }

          const interestCost = borrowAmount * rate;
          if (interestCost > budget) {
            return {
              success: false,
              message: `Budget breached! Repo interest cost is $${interestCost.toFixed(2)}M, which exceeds our maximum penalty budget of $${budget}M.`
            };
          }

          return {
            success: true,
            message: `Systemic crisis averted! Solvency restored with LCR at ${endingLcr.toFixed(1)}% and interest overhead contained at $${interestCost.toFixed(2)}M.`
          };
        }

        default:
          return { success: false, message: 'Verification not implemented for this scenario.' };
      }
    } catch (e: any) {
      return { success: false, message: `Solution error: ${e.message}` };
    }
  }
}
