# Failed Payment Reference / Demo System

This file preserves the code for the old demo payment system that was used to try testing payments before real integration. It was originally inside `PaymentPage.jsx` but was removed to keep the production code clean.

## The Demo Setup Logic
This function mocked a fake job (`demo-123`) with a 1 Rupee charge to test the gateway response.

```javascript
  const setupDemoPayment = async () => {
    try {
      setLoading(true)
      const demoJob = {
        id: 'demo-123',
        filename: 'Presentation_Final.pdf',
        copies: 1,
        paper_size: 'A4',
        color_mode: 'Color',
        print_type: 'Single-sided',
        total_cost: 1.00 // Test with 1 Rupee
      }
      setJob(demoJob)
      setShop({ name: 'Demo Print Shop' })

      await initiateUPIGateway(demoJob)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
```

## How the Demo mode was triggered
It bypassed the Supabase load completely by checking if the URL had `demo` as the parameter:

```javascript
  // State 
  const [isDemo, setIsDemo] = useState(false)

  // UseEffect Hook
  useEffect(() => {
    if (jobId === 'demo') {
      setIsDemo(true)
      setupDemoPayment()
    } else {
      loadJobDetails()
    }
  }, [jobId])
```

## How status polling suppressed real database updates
During demo mode, we prevented the polling function from trying to update a fake ID in Supabase:

```javascript
        // In startStatusPolling
        setJob((currentJob) => {
          if (currentJob && currentJob.id !== 'demo-123') {
            updatePaymentStatus(currentJob.id, 'paid')
          }
          return currentJob
        })
```

## UI Fallbacks for Demo
If a payment was successful while in Demo mode, it did not redirect to `StatusPage` since `demo-123` doesn't exist in the database. Instead:

```javascript
          {!isDemo && <p className="text-sm text-gray-400">Redirecting to status page...</p>}
          {isDemo && (
            <button onClick={() => navigate('/')} className="btn-primary w-full mt-4">Back to Home</button>
          )}

        {/* Footer Notice */}
        {isDemo && (
          <p className="text-center mt-6 text-xs text-slate-400">
            This is a <span className="font-bold text-blue-500 underline">Demo Transaction</span> using your API Key.
          </p>
        )}
```
