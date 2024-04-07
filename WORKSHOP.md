# Optimizing Kubernetes Operators and Admission Control with Pepr

The format to run this workshop is phase by phase moving on after each activity is complete. The markdown has a corresponding repo https://github.com/cmwylie19/enterprise-admission-controller.git where each phase has a corresponding branch. If you ever get stuck you can peek at the repo.  

### TOC
- [Background](#background)
- [Phase 1 - Get to know Hello Pepr](#phase-1)
- [Activity 1 - Run Hello Pepr](#activity-1)
- [Phase 2 - Validating Security Posture](#phase-2)
- [Activity 2 - No privileged pods](#activity-2)
- [Phase 3 - Mutating Security Posture](phase-3)
- [Activity 3 - Standardized security contexts](#activity-3)
- [Phase 4 - Organizational Knowledge](#phase-4)
- [Activity 4 - When there is static, slap the TV](#activity-4)

## Prereqs

- Mac or Linux
- Node.js v18.0.0+ (even-numbered releases only)
- npm v10.1.0+
- Visual Studio Code for inline debugging and Pepr Capabilities creation.
- [k3d](https://k3d.io/v5.6.0/) - A Kubernetes cluster for npx pepr dev. Pepr modules include npm run k3d-setup if you want to test locally with K3d and Docker.
- `kubectl`
- [jq](https://jqlang.github.io/jq/) 

### Background 

You are the Chief Architect at Big Enterprise Co which maintains over 200 production apps all from different teams. You are overseeing an effort to migrate all apps to a new multi-cloud HA Kubernetes cluster. 

It is your job to ensure: 
- All 200 Apps are migrated
- Apps meets security requirements
- Apps meet resource requirements 
- The teams are able to quickly release patches and updates

Big Enterprise Co maintains strict standards across the board and does not make exceptions for any team. The teams have different levels of experience in Kubernetes. In order to enforce standarization, you decide to create an Admission Controller so that all resoufcres entering the cluster are validated and mutated to meet the standards.

After researching potential Admission Controllers, you decide to use Pepr because:
- It is [Fully Open Source](https://github.com/defenseunicorns/pepr)
- It allows the creation of Policy to dictate what can enter a Kubernetes Cluster like a Kyverno or an OPA Gatekepper
- It has a Kubernetes Watch Mechanism like Operator-SDK or Kube-Builder allowing you to write full Kubernetes native applications to simplify advanced configuration
- It is lightweight and developer friendly with a simple, easy to use, API and comes with intellisense out of the box
- It comes with an intuitive [Kubernetes Client](https://github.com/defenseunicorns/kubernetes-fluent-client) that uses [Server Side Apply](https://kubernetes.io/docs/reference/using-api/server-side-apply/) as a more efficient means to speak to the Kube-APIServer.

## Phase 1

The first order of business is to create the scaffolding for your Admission Controller, call it `enterprise-admission-controller`. 

Initialize a new Pepr module. (This is what we call a project in Pepr)

```bash
npx pepr init
```

You will be asked for a description for the module, and what to do in the event of a failure

```plaintext
✔ Enter a name for the new Pepr module. This will create a new directory based on the name.
 … enterprise-admission-controller
✔ (Recommended) Enter a description for the new Pepr module.
 … DevopsDaysRaleigh 2024
✔ How do you want Pepr to handle errors encountered during K8s operations? › Reject the operation

  To be generated:

    enterprise-admission-controller
    ├── .eslintrc.json
    ├── .gitignore
    ├── .prettierrc
    ├── capabilties
    │   ├── hello-pepr.samples.yaml     
    │   └── hello-pepr.ts     
    ├── package.json
    │   {
    │     name: 'enterprise-admission-controller',
    │     version: '0.0.1',
    │     description: 'DevopsDaysRaleigh 2024',
    │     keywords: [ 'pepr', 'k8s', 'policy-engine', 'pepr-module', 'security' ],
    │     engines: { node: '>=18.0.0' },
    │     pepr: {
    │       uuid: 'c8219d66-6901-5ef5-bcd5-6bb66f6afbb7',
    │       onError: 'reject',
    │       webhookTimeout: 10,
    │       customLabels: { namespace: { 'pepr.dev': '' } },
    │       alwaysIgnore: { namespaces: [] },
    │       includedFiles: [],
    │       env: {}
    │     },
    │     scripts: {
    │       'k3d-setup': "k3d cluster delete pepr-dev && k3d cluster create pepr-dev --k3s-arg '--debug@server:0' --wait && kubectl rollout status deployment -n kube-system"
    │     },
    │     dependencies: { pepr: '0.28.7' },
    │     devDependencies: { typescript: '5.3.3' }
    │   }
    ├── pepr.ts
    ├── README.md
    └── tsconfig.json
      
? Create the new Pepr module? › (y/N)
```

A new VSCode prject will pop up. Run `npm i` to install the modules, then spend a few moments looking over `capabilities/hello-pepr.ts` to try and get an idea how Pepr works.

Notice how you able to to Mutate, Validate, and Watch Kubernetes Object.

The general format for each "binding" is:

```plaintext
When(a.<KubernetesObject>)
.<event>(IsCreated/IsUpdated/IsCreatedOrUpdated/IsDeleted)
.<filters>(WithName/WithLabel/WithAnnotation/InNamespace)
.<callback>(Mutate/Validate/Watch/Reconcile)
```


Next, create our dev cluster by running: `npm run k3d-setup`:

#### Activity 1

Open a `JavaScript Debug Terminal` in VSCode

![image](https://gist.github.com/assets/1096507/d3c24776-48b3-45c0-a2a8-fd3f0e03f998)

inside of the debug terminal:

```bash
npx pepr dev --confirm
```

The debug terminal will be used to look at logs for Activity 1.

Wait until you see a log like `[xx:xx:xx.xxx] INFO (xxxxx): ✅ Scheduling processed`.

Next, open a second terminal beside of the debug terminal and create the namespace `pepr-demo`:

On line 38 of `capabilites/hello-pepr.ts` we see that inside of the Mutate callback there is a `RemoveLabel("remove-me")`. Lets create a namespace with that label and test that it properly Mutates the remove-me label.

```yaml
kubectl apply -f -<<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: pepr-demo
  labels:
    keep-me: please
    remove-me: right-now
EOF
```

By checking the labels we see that Pepr mutated the remove-me label: 

```bash
kubectl get ns pepr-demo --show-labels
```

output
```plaintext
NAME        STATUS   AGE   LABELS
pepr-demo   Active   6s    keep-me=please,kubernetes.io/metadata.name=pepr-demo
```

On line 157 of `capabilites/hello-pepr.ts` there is a Validate that should reject any ConfigMap created with annotation `evil`. Create a ConfigMap in `pepr-demo` with an evil annotation:

```yaml
kubectl apply -f -<<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: example-evil-cm
  namespace: pepr-demo
  annotations:
    evil: 'true'
data:
  key: ex-evil-cm-val
EOF
```

We see that the validating webhook rejected the ConfigMap

output

```plaintext
Error from server: error when creating "STDIN": admission webhook "pepr-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.pepr.dev" denied the request: No evil CM annotations allowed.
```

Finally, lets see how `Watch` works. On line 51 of `capabilites/hello-pepr.ts` change `.WithName("pepr-demo-2")` to `.WithName("pepr-demo")` and line 53 change `Log.info("Namespace pepr-demo-2 was created.");` to `Log.info("Namespace pepr-demo was updated again.");`, line 60 to `pepr-demo` from `pepr-demo-2` and save.

Lines 49-73 should look like
```ts
When(a.Namespace)
  .IsCreatedOrUpdated()
  .WithName("pepr-demo")
  .Watch(async ns => {
    Log.info("Namespace pepr-demo was updated again.");

    try {
      // Apply the ConfigMap using K8s server-side apply
      await K8s(kind.ConfigMap).Apply({
        metadata: {
          name: "pepr-ssa-demo",
          namespace: "pepr-demo",
        },
        data: {
          "ns-uid": ns.metadata.uid,
        },
      });
    } catch (error) {
      // You can use the Log object to log messages to the Pepr controller pod
      Log.error(error, "Failed to apply ConfigMap using server-side apply.");
    }

    // You can share data between actions using the Store, including between different types of actions
    Store.setItem("watch-data", "This data was stored by a Watch Action.");
  });
```

update the namespace `pepr-demo` while looking at logs in the debug terminal

```bash
kubectl label ns pepr-demo hello=devopsdaysraleigh
```

You should see a log with level INFO with:

```plaintext
[xx:xx:xx.xxx] INFO (xxxxx): Namespace pepr-demo was updated again
```

and there should be a new configMap created in `pepr-demo` named `pepr-ssa-demo`:

```yaml
kubectl get cm -n pepr-demo pepr-ssa-demo -oyaml
```

output

```plaintext
apiVersion: v1
data:
  ns-uid: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
kind: ConfigMap
metadata:
  name: pepr-ssa-demo
  namespace: pepr-demo
  uid: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```  

The Kubernetes Fluent Client created a resource when Pepr received the `Watch` event from Kubernetes API Server.

Before moving on, play with the intellisense. Starting typing 

```ys
When(a.<notice_intellisense>).<notice_intellisense>.<notice_intellisense>
```

Developer experience is a first class citizen in Pepr and it will help you move faster from prototype to MVP.

Anytime you make changes or want to format your code use

```bash
npx pepr format
```

which will tree-shake your code ensuring your module is as small as possible

## Phase 2

Big Enterprise Co has been exploited when hackers reversed shelled out of an over privileged container and sensitive data was stolen from the nodes. Now, they have a zero tolerance policy on privileged containers. 

#### Activity 2

Create a new action to enforce the new security standard that containers running as privileged are not allowed to enter the cluster.

Hint:
1. Copy `capability/hello-pepr.ts` to `capability/admission.ts`
2. Change the HelloPepr capability to the Admission Capability
3. Remove the actions and create a new one for When a Pod is created or updated
4. Set the capability namespaces to `namespaces: []` which means all namespaces so that the policy applies to all namespaces
5. Use the helper function `containers()` from `pepr/sdk` to return all containers on a pod
6. Update `pepr.ts` to point to admission.ts
7. Look back in hello-pepr.ts to see how the validates work

```ts
import { sdk } from "pepr/sdk"

export const Admission = new Capability({
  name: "Admission",
  description: "Global admission controler.",
  namespaces: [],
});

const { containers } = sdk;
const { When } = Admission;

When(a.Pod)
.IsCreatedOrUpdated()
.Validate(po => {
    // Now traverse the list of containers to check the securityContexts
    let podContainers = containers(po);
})
```

_Check Correctness_

To check if your module correctly rejects privileged pods:
1. Refresh your cluster: `npm run k3d-setup`
2. Open a javascript debug terminal and run `npx pepr format --confirm`
3. Apply test resources below
```yaml
kubectl apply -f -<<EOF
---
apiVersion: v1
kind: Namespace
metadata:
  creationTimestamp: null
  name: phase-2
spec: {}
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: double-privileged-po
  name: double-privileged-po
  namespace: phase-2
spec:
  containers:
  - image: nginx
    name: double-privileged-po
    resources: {}
    securityContext:
      privileged: true
      allowPrivilegeEscalation: true
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: privileged-po
  name: privileged-po
  namespace: phase-2
spec:
  containers:
  - image: nginx
    name: privileged-po
    resources: {}
    securityContext:
      privileged: true
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: escalated-privileged-po
  name: escalated-privileged-po
  namespace: phase-2
spec:
  containers:
  - image: nginx
    name: escalated-privileged-po
    resources: {}
    securityContext:
      allowPrivilegeEscalation: true
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: unprivileged-po
  name: unprivileged-po
  namespace: phase-2
spec:
  containers:
  - image: nginx
    name: unprivileged-po
    resources: {}
    securityContext: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: root-user-pod
  name: root-user-pod
  namespace: phase-2
spec:
  containers:
  - image: nginx
    name: root-user-pod
    resources: {}
    securityContext:
      runAsUser: 0
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
EOF
```
4. Check correctness of pods admitted into the cluster:  
```bash
kubectl get po -n phase-2 --no-headers -o custom-columns=NAME:.metadata.name
```

**expected output**
```plaintext
unprivileged-po
root-user-pod
```

If you got the expected output, you win! Go to the next. **DO NOT DELETE YOUR CLUSTER**


**Thought Challenge:** Notice we allowed pod `root-user-pod` into the cluster. The policy we created only cares about privilege escalation but in the real world there are many more dangerous events that can happen in a cluster like certain securityContext settings on a container or pod or volume with Write privilege bound directory to the node. A production Admission Controller would be to have a more robust security posture.

## Phase 3 

Big Enterprise Co has started to enhance its security posture, your bosses are pleased, but you can't help noticed the Pod and Container securityContexts are all over the map. Some pods are running as user 0 (which is a problem), some are running as user 655532, and some are running as 1000. Now you need standardization.  

Our goal is to standarize the `runAsUser` securityContext for pods and containers. Keep in mind we do NOT want to override existing `runAsUser` securityContext, but to define them should they not be defined. _The only case where we could override a securityContext is if the pod or container was running as user 0._

#### Activity 3

Create a new action to Mutate pods (and the containers of said pod) to have a default runAsUser value:
- If no runAsUser value exists - assign 655532
- If a runAsUser exists, only override if value is set to less than 10, in that case override value to 1000
- If pod has label ignore-me, do not override runAsUser even if it is less than 10

Hint:
1. Add a new Mutate action to `capability/admission.ts`
2. Remember that pods and containers both have securityContext.runAsUser
3. There are containers, initContainers, and ephemeralContainers
4. use the containers function to see if you need to update any containers
5. Create a helper to re-use code `containerHelper`


```ts
import { sdk } from "pepr/sdk"
// V1Container is the container type for the helper
import { V1Container } from "@kubernetes/client-node";

export const Admission = new Capability({
  name: "Admission",
  description: "Global admission controler.",
  namespaces: [],
});

const { containers } = sdk;
const { When } = Admission;

// existing
When(a.Pod)
.IsCreatedOrUpdated()
.Validate(po => {})

// new
const containerHelper = (container: V1Container) => {...}
When(a.Pod)
.IsCreatedOrUpdated()
.Mutate(po => {})
``` 


_Check Correctness_

To check if your module correctly rejects privileged pods:
1. Open a javascript debug terminal and run `npx pepr format --confirm`
2. Apply test resources below. 

```yaml
kubectl apply -f -<<EOF
---
apiVersion: v1
kind: Namespace
metadata:
  creationTimestamp: null
  name: phase-3
spec: {}
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  labels:
    run: po
    ignore-me: sure
  name: ignore-me
  namespace: phase-3
spec:
  securityContext:
    runAsUser: 5
  containers:
  - image: nginx
    name: po
    securityContext:
      runAsUser: 5
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: mutate-pod
  name: mutate-pod-leave-container
  namespace: phase-3
spec:
  securityContext:
    runAsUser: 5
  containers:
  - image: nginx
    name: mutate-pod
    securityContext:
      runAsUser: 5555
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: mutate-pod
  name: mutate-pod-mutate-container
  namespace: phase-3
spec:
  securityContext:
    runAsUser: 5
  containers:
  - image: nginx
    name: mutate-pod
    securityContext:
      runAsUser: 5
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: mutate-to-default
  name: mutate-to-default
  namespace: phase-3
spec:
  containers:
  - image: nginx
    name: mutate-to-default
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
EOF
```

3. Check the correctness of the mutated pods:

Ignore-me pod should have not been mutated, both runAsUser should be 5.  

```bash
kubectl get po ignore-me -o custom-columns='PodSecurityContext:.spec.securityContext.runAsUser,ContainerSecurityContext:.spec.containers[*].securityContext.runAsUser' -n phase-3
```

**expected output**
```plaintext
PodSecurityContext   ContainerSecurityContext
5                    5
```

mutate-pod-leave-container pod should have mutated only the pod and not the container  

```bash
kubectl get po mutate-pod-leave-container -o custom-columns='PodSecurityContext:.spec.securityContext.runAsUser,ContainerSecurityContext:.spec.containers[*].securityContext.runAsUser' -n phase-3
```

**expected output**
```plaintext
PodSecurityContext   ContainerSecurityContext
1000                 5555
```

mutate-pod-mutate-container pod should have mutated both the pod and the container to 1000 since it was set at 5

```bash
kubectl get po mutate-pod-mutate-container -o custom-columns='PodSecurityContext:.spec.securityContext.runAsUser,ContainerSecurityContext:.spec.containers[*].securityContext.runAsUser' -n phase-3
```

**expected output**
```plaintext
PodSecurityContext   ContainerSecurityContext
1000                 1000
```

mutate-to-defaults pod should have mutated both the pod and the container to 1000 since it was set at 5

```bash
kubectl get po mutate-to-defaults -o custom-columns='PodSecurityContext:.spec.securityContext.runAsUser,ContainerSecurityContext:.spec.containers[*].securityContext.runAsUser' -n phase-3
```

**expected output**
```plaintext
PodSecurityContext   ContainerSecurityContext
655532               655532
```

If you got the expected output, you win! Go to the next. **DO NOT DELETE YOUR CLUSTER**


**Thought Challenge:** Pod/Container securityContexts has many more options like fsGroups, runAsNonRoot, sysctls depending on whether it is a pod or container. A more robust admission controller would need to consider all of the possibilities. 

## Phase 4

Pepr features a full featured Store and Schedule. Back in [Phase 3](#phase-3) we were applying default runAsUser securityContexts but we ignored pods with label `ignore-me`. Big Enterprise Co wants to run a job that reports the last app that uses the ignore label every 10 seconds. You were thinking about using a Kubernetes native CronJob, but you realize with Pepr's Store and Schedule you can do this all in one place.

#### Activity 4

_This activity is more metaphorical than a real world use-case, the idea is to learn to use the Store and Schedule._

We need to update the `capability/admission.ts` to store the last pod that has the label `ignore-me` and then create a schedule that runs every 10 seconds to check the store for the last pod that has the label `ignore-me`.

Todo:
- Update the Mutate action that is looking for pods that were CreatedOrUpdated, if the pod has label "ignore-me", set the pod in the store with `Store.setItem("last-ignore-me", po.Raw.metadata.name);`
- Create an OnSchedule that gets the item from the store "last-ignore-me" and does a Log.info("Last ignored pod was xxx") and then sets another item in the store "pass" to "{name-of-pod}".


Hint:
- [OnSchedule](https://docs.pepr.dev/main/user-guide/onschedule/) Docs
- [Store](https://docs.pepr.dev/main/user-guide/store/) Docs
1. Make sure you run Pepr with PEPR_WATCH_MODE=true in order to use the schedule`PEPR_WATCH_MODE="true"  npx pepr dev --confirm`

```ts
const { When, Store, OnSchedule } = Admission;

OnSchedule({
  name: "...",
  every: ?,
  unit: "seconds",
  run:  () => {...},
});

When(a.Pod)
  .IsCreatedOrUpdated()
  .Mutate(po => {
    if (!po.HasLabel("ignore-me")) {

    } else {
      ....
    }
```

_Check Correctness_

```yaml
kubectl apply -f -<<EOF
---
apiVersion: v1
kind: Namespace
metadata:
  creationTimestamp: null
  name: phase-4
spec: {}
status: {}
---
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: null
  labels:
    run: legacy-app
    alert: critical
    ignore-me: sure
  name: legacy-app
  namespace: phase-4
spec:
  containers:
  - image: nginx
    name: legacy-app
    resources: {}
  dnsPolicy: ClusterFirst
  restartPolicy: Always
status: {}
EOF
sleep 20
kubectl get peprstore -n pepr-system -oyaml | grep pass
```

**expected output**

```plaintext
    Admission-pass: legacy-app
```

## Phase 5

As part of your job at Big Enterprise Co, you must onboard applications onto the Kubernetes cluster with 200 apps in production. The problem is that these applications have complex configurations and the teams have no experience in Kubernetes. The team knows their app but not how to deploy it. Your job is to make it easier for the team to deploy their application by consolidating the amount of Kubernetes resources that it takes to deploy their app. Typically the app would need:"
- Deployment
- Service
- ConfigMap

Your job is to consolidate this down to onw resource so that the team can focus more on building the app and less on the deployment specifics.

#### Activity 5

The app that is causing issues is a webapp that can be deployed in English, Spanish, with a Dark or White theme at a given number of replicas less than 10. At this point the pods already have default security contrexts that the admisson controller will take care of. Now we must build the operator


## Steps

1 - Admission Controller. 
  
2 - Security Posture - Pods runAsNonRoot. 
  
3 - SecurityPosture - Mutate  securityContext. 
  
4 - Organizational Knowledge - Slap the TV. 
  
5 - Watch Resources. 
  
6 - Reconcile Resource. 
  
7 - Deploy   


#### [TOP](#optimizing-kubernetes-operators-and-admission-control-with-pepr)
