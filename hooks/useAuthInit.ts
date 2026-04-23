import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types';

const BOOTSTRAP_ADMIN_EMAIL = 'truongdq54@gmail.com';

export const useAuthInit = () => {
  const { setAuth, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      try {
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (!userDoc.exists()) {
            const isBootstrapAdmin = user.email === BOOTSTRAP_ADMIN_EMAIL;
            const newProfile = {
              uid: user.uid,
              email: user.email || '',
              isActive: isBootstrapAdmin,
              isAdmin: isBootstrapAdmin,
              fullName: user.displayName || '',
              createdAt: serverTimestamp() as any,
              lastLoginAt: serverTimestamp() as any,
            };
            await setDoc(userDocRef, newProfile);
            setAuth(user, newProfile as UserProfile);
          } else {
            const userData = userDoc.data();
            const updates: any = { lastLoginAt: serverTimestamp() };
            if (!userData?.fullName && user.displayName) {
              updates.fullName = user.displayName;
            }
            await setDoc(userDocRef, updates, { merge: true });
            setAuth(user, { ...userData, ...updates, uid: user.uid } as UserProfile);
          }
        } else {
          setAuth(null, null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setAuth, setLoading]);
};

