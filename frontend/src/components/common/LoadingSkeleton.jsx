const Skeleton = ({ className = '' }) => (
  <div className={`skeleton shimmer ${className}`}>&nbsp;</div>
);

export const ChatListSkeleton = () => (
  <div className="space-y-1 p-3 stagger-children">
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-3 w-10 rounded-md" />
          </div>
          <Skeleton className="h-3 w-4/5 rounded-md" />
        </div>
      </div>
    ))}
  </div>
);

export const MessageSkeleton = () => (
  <div className="space-y-4 p-4 stagger-children">
    {[1, 2, 3, 4, 5, 6].map((i) => {
      const isSent = i % 2 === 0;
      const widths = ['w-48', 'w-56', 'w-40', 'w-64', 'w-52', 'w-44'];
      return (
        <div key={i} className={`flex gap-2 ${isSent ? 'justify-end' : 'justify-start'}`}>
          {!isSent && <Skeleton className="w-8 h-8 rounded-full flex-shrink-0 mt-auto" />}
          <div className={`flex flex-col ${isSent ? 'items-end' : 'items-start'}`}>
            <Skeleton className={`h-10 rounded-2xl ${isSent ? 'rounded-br-sm' : 'rounded-bl-sm'} ${widths[i - 1]}`} />
            <Skeleton className="h-2.5 w-12 rounded-full mt-1.5" />
          </div>
        </div>
      );
    })}
  </div>
);

export const ProfileSkeleton = () => (
  <div className="p-8 space-y-6 stagger-children">
    <div className="flex justify-center">
      <Skeleton className="w-28 h-28 rounded-full" />
    </div>
    <div className="space-y-3">
      <Skeleton className="h-7 w-40 mx-auto rounded-lg" />
      <Skeleton className="h-4 w-28 mx-auto rounded-md" />
      <Skeleton className="h-4 w-56 mx-auto rounded-md" />
    </div>
    <div className="space-y-3 mt-8">
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  </div>
);

export const UserSearchSkeleton = () => (
  <div className="space-y-1 p-3 stagger-children">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-2/5 rounded-md" />
          <Skeleton className="h-3 w-3/5 rounded-md" />
        </div>
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    ))}
  </div>
);

export default Skeleton;
